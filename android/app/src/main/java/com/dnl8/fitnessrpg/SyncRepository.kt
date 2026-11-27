package com.dnl8.fitnessrpg

import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.ceil
import kotlinx.coroutines.sync.Mutex

internal val healthSyncMutex = Mutex()

internal fun validHealthNumber(value: Any?): Double? =
    (value as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }

/** Imports authorized Health Connect readings into the signed-in account. */
class SyncRepository(private val authRepository: AuthRepository) {
    private fun date(instant: Instant): String = instant.atZone(ZoneId.systemDefault()).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
    private data class Daily(var steps: Long? = null, var calories: Double? = null, var sleepHours: Double? = null)
    data class SyncResult(val imported: Int, val duplicates: Int, val days: Int)
    private data class Hr(val time: Instant, val bpm: Double)

    suspend fun syncRecords(
        records: List<HealthRecord>, session: String, onProgress: (Int, Int) -> Unit = { _, _ -> },
    ): SyncResult {
        val account = authRepository.getCurrentUserId() ?: error("Entre novamente.")
        val daily = sortedMapOf<String, Daily>()
        val samples = mutableMapOf<Instant, Double>()
        val exercises = mutableListOf<HealthRecord>()
        for (record in records.distinctBy { it.id to it.type }) {
            when (record.type) {
                "steps" -> {
                    val count = validHealthNumber(record.values["count"]) ?: continue
                    daily.getOrPut(date(record.startTime)) { Daily() }.steps = count.toLong().coerceIn(0, 200000)
                }
                "calories" -> {
                    val calories = validHealthNumber(record.values["kilocalories"]) ?: continue
                    daily.getOrPut(date(record.startTime)) { Daily() }.calories = calories.coerceIn(0.0, 20000.0)
                }
                "sleep" -> {
                    val hours = validHealthNumber(record.values["hours"]) ?: continue
                    daily.getOrPut(date(record.endTime)) { Daily() }.let { it.sleepHours = ((it.sleepHours ?: 0.0) + hours).coerceIn(0.0, 24.0) }
                }
                "exercise" -> if (record.endTime.isAfter(record.startTime)) exercises.add(record)
                "heart_rate" -> {
                    val readings = record.values["samples"] as? List<*> ?: continue
                    for (item in readings) {
                        val sample = item as? Map<*, *> ?: continue
                        val bpm = validHealthNumber(sample["beatsPerMinute"]) ?: continue
                        val time = runCatching { Instant.parse(sample["time"] as? String ?: "") }.getOrNull() ?: continue
                        if (bpm in 30.0..250.0) samples[time] = bpm
                    }
                }
            }
        }
        val hr = samples.entries.sortedBy { it.key }.map { Hr(it.key, it.value) }
        val activities = exercises.distinctBy { Triple(it.startTime, it.endTime, it.values["exerciseType"]) }.map { ex ->
            val readings = hr.filter { !it.time.isBefore(ex.startTime) && it.time.isBefore(ex.endTime) }.map { it.bpm }
            val stride = ceil(readings.size / 40.0).toInt().coerceAtLeast(1)
            val points = readings.filterIndexed { i, _ -> i % stride == 0 }.take(40)
            JSONObject().put("externalId", "health-connect-${ex.id}").put("source", "health_connect")
                .put("title", (ex.values["title"] as? String)?.trim()?.takeIf { it.isNotBlank() }?.take(200) ?: "Exercício do Health Connect")
                .put("sportType", "exercise_${ex.values["exerciseType"] ?: "unknown"}")
                .put("dateKey", date(ex.startTime)).put("startedAt", ex.startTime.toString())
                .put("durationMinutes", Duration.between(ex.startTime, ex.endTime).seconds / 60.0)
                // Legacy wire contract requires numbers; the report treats unmeasured zeros as unavailable.
                .put("distanceKm", 0).put("calories", 0).put("elevationGainM", 0)
                .put("avgHeartRate", if (readings.isEmpty()) JSONObject.NULL else readings.average())
                .put("maxHeartRate", readings.maxOrNull() ?: JSONObject.NULL)
                .put("zoneMinutes", JSONArray(listOf(0, 0, 0, 0, 0))).put("hrSamplePoints", JSONArray(points))
        }
        val metrics = daily.map { (day, value) ->
            JSONObject().put("dateKey", day).apply {
                value.steps?.let { put("steps", it) }
                value.calories?.let { put("activeCalories", it) }
                value.sleepHours?.let { put("sleepHours", it) }
            }
        }
        // Raw HR readings are not treated as workouts or awarded XP.
        val batchSize = 25
        val batches = (maxOf(activities.size, metrics.size) + batchSize - 1) / batchSize
        var imported = 0
        var duplicates = 0
        var days = 0
        for (batch in 0 until batches) {
            check(authRepository.getCurrentUserId() == account) { "A conta foi alterada durante a sincronização." }
            val offset = batch * batchSize
            val body = JSONObject().put("source", "health_connect")
                .put("activities", JSONArray(activities.drop(offset).take(batchSize)))
                .put("dailyMetrics", JSONArray(metrics.drop(offset).take(batchSize)))
            val response = NativeApi.request(
                MurimApiContract.HEALTH_CONNECT_PATH, "POST", body, expectedSession = session,
            ).body
            imported += response.getInt("imported")
            duplicates += response.getInt("duplicates")
            days += response.getInt("days")
            onProgress(batch + 1, batches)
        }
        return SyncResult(imported, duplicates, days)
    }
}
