package com.dnl8.fitnessrpg

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.reflect.KClass

data class HealthRecord(
    val id: String,
    val type: String,
    val startTime: Instant,
    val endTime: Instant,
    val values: Map<String, Any>,
)

class HealthConnectManager(context: Context) {
    private val client = HealthConnectClient.getOrCreate(context)

    val supportsBackgroundRead: Boolean
        get() = client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    suspend fun hasReadPermission(): Boolean =
        client.permissionController.getGrantedPermissions().any { it in permissions }

    suspend fun canReadInBackground(): Boolean {
        if (!supportsBackgroundRead) return false
        val granted = client.permissionController.getGrantedPermissions()
        return backgroundPermission in granted && permissions.any { it in granted }
    }

    companion object {
        val backgroundPermission = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

        private val recordTypes: Set<KClass<out Record>> = setOf(
            ExerciseSessionRecord::class, StepsRecord::class, HeartRateRecord::class,
            ActiveCaloriesBurnedRecord::class, SleepSessionRecord::class,
        )
        val permissions = recordTypes.map { HealthPermission.getReadPermission(it) }.toSet()
    }

    suspend fun changeScope(): Set<KClass<out Record>> {
        val granted = client.permissionController.getGrantedPermissions()
        return recordTypes.filter { HealthPermission.getReadPermission(it) in granted }.toSet()
    }

    suspend fun freshChangesToken(types: Set<KClass<out Record>>): String =
        client.getChangesToken(ChangesTokenRequest(recordTypes = types))

    // A single page is sufficient to decide whether a full aggregate refresh is needed.
    suspend fun unchangedToken(token: String): String? {
        val result = client.getChanges(token)
        return reusableChangesToken(result.changesTokenExpired, result.hasMore,
            result.changes.isNotEmpty(), result.nextChangesToken)
    }

    suspend fun readRecentRecords(): List<HealthRecord> {
        val grantedPermissions = client.permissionController.getGrantedPermissions()
        check(permissions.any { it in grantedPermissions }) {
            "Conceda acesso a pelo menos um tipo de dado no Health Connect antes de sincronizar."
        }
        val start = Instant.now().minus(30, ChronoUnit.DAYS)
        val range = TimeRangeFilter.after(start)
        val records = mutableListOf<HealthRecord>()

        // Envia totais diários primeiro (usados diretamente pelo painel web)
        records += readDailyTotals(grantedPermissions)

        readPermittedRecords<SleepSessionRecord>(grantedPermissions, range).forEach { record ->
            if (record.endTime.isBefore(record.startTime)) return@forEach
            val sleepStages = record.stages.filter { stage ->
                stage.stage in setOf(
                    SleepSessionRecord.STAGE_TYPE_SLEEPING,
                    SleepSessionRecord.STAGE_TYPE_LIGHT,
                    SleepSessionRecord.STAGE_TYPE_DEEP,
                    SleepSessionRecord.STAGE_TYPE_REM,
                )
            }
            val sleepMinutes = if (record.stages.isEmpty()) {
                java.time.Duration.between(record.startTime, record.endTime).toMinutes()
            } else {
                sleepStages.sumOf { stage ->
                    java.time.Duration.between(stage.startTime, stage.endTime).toMinutes().coerceAtLeast(0L)
                }
            }
            if (sleepMinutes <= 0) return@forEach
            val id = sanitizeRecordId("sleep_${record.startTime.toEpochMilli()}_${record.endTime.toEpochMilli()}", "sl")
            records += HealthRecord(
                id,
                "sleep",
                record.startTime,
                record.endTime,
                mapOf("hours" to (sleepMinutes / 60.0).coerceIn(0.0, 24.0)),
            )
        }

        readPermittedRecords<ExerciseSessionRecord>(grantedPermissions, range).forEach {
            if (it.endTime.isBefore(it.startTime)) return@forEach
            records += HealthRecord(
                sanitizeRecordId(it.metadata.id, "ex"),
                "exercise",
                it.startTime,
                it.endTime,
                mapOf(
                    "exerciseType" to it.exerciseType,
                    "title" to (it.title ?: "").take(200),
                ),
            )
        }
        readPermittedRecords<HeartRateRecord>(grantedPermissions, range).forEach { record ->
            if (record.endTime.isBefore(record.startTime)) return@forEach
            val validSamples = record.samples.filter { it.beatsPerMinute in 1L..300L }
            if (validSamples.isEmpty()) return@forEach
            val baseId = sanitizeRecordId(record.metadata.id, "hr")
            validSamples.chunked(4000).forEachIndexed { index, samples ->
                val id = if (index == 0) baseId else sanitizeRecordId("${baseId}_$index", "hr")
                records += HealthRecord(
                    id, "heart_rate", record.startTime, record.endTime,
                    mapOf("samples" to samples.map { sample ->
                        mapOf("beatsPerMinute" to sample.beatsPerMinute, "time" to sample.time.toString())
                    }),
                )
            }
        }
        return records
    }

    private fun sanitizeRecordId(raw: String, prefix: String): String {
        if (raw.length in 1..128 && raw.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-' }) {
            return raw
        }
        val cleaned = raw.replace(Regex("[^A-Za-z0-9_-]"), "_")
        if (cleaned.length in 1..128) return cleaned
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(raw.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
            .take(40)
        return "${prefix}_$digest"
    }

    private suspend fun readDailyTotals(grantedPermissions: Set<String>): List<HealthRecord> {
        val metrics = mutableSetOf<AggregateMetric<*>>()
        if (HealthPermission.getReadPermission(StepsRecord::class) in grantedPermissions) {
            metrics += StepsRecord.COUNT_TOTAL
        }
        if (HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class) in grantedPermissions) {
            metrics += ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL
        }
        if (metrics.isEmpty()) return emptyList()

        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val groups = client.aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics,
                TimeRangeFilter.between(today.minusDays(29).atStartOfDay(), today.plusDays(1).atStartOfDay()),
                Period.ofDays(1),
            )
        )
        return buildList {
            for (group in groups) {
                val day = group.startTime.toLocalDate()
                val from = group.startTime.atZone(zone).toInstant()
                val to = group.endTime.atZone(zone).toInstant()
                if (StepsRecord.COUNT_TOTAL in metrics) {
                    val steps = group.result[StepsRecord.COUNT_TOTAL]
                    if (steps != null) add(HealthRecord("hc_daily_${day}_steps", "steps", from, to,
                        mapOf("count" to steps.coerceIn(0L, 200000L))))
                }
                if (ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL in metrics) {
                    val calories = group.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                    if (calories != null) add(HealthRecord("hc_daily_${day}_calories", "calories", from, to,
                        mapOf("kilocalories" to calories.coerceIn(0.0, 20000.0))))
                }
            }
        }
    }

    private suspend inline fun <reified T : Record> readPermittedRecords(
        grantedPermissions: Set<String>,
        range: TimeRangeFilter,
    ): List<T> {
        if (HealthPermission.getReadPermission(T::class) !in grantedPermissions) {
            return emptyList()
        }
        val records = mutableListOf<T>()
        var pageToken: String? = null
        var iterations = 0
        val maxIterations = 100 // Proteção contra loop infinito na paginação
        
        do {
            // Proteção contra loop infinito: número máximo de iterações
            check(iterations < maxIterations) { "Paginação do Health Connect incompleta." }
            iterations++
            
            val page = client.readRecords(ReadRecordsRequest(T::class, range, pageToken = pageToken))
            val newPageToken = page.pageToken
            
            // Se pageToken não mudou após leitura, interrompe para evitar loop
            check(newPageToken == null || newPageToken != pageToken) { "Paginação do Health Connect repetida." }
            
            records += page.records
            pageToken = newPageToken
        } while (pageToken != null)
        
        return records
    }
}
