package com.dnl8.fitnessrpg

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

internal data class HealthDay(
    val date: LocalDate,
    val steps: Double? = null,
    val calories: Double? = null,
    val exerciseMinutes: Double? = null,
    val longestSleepHours: Double? = null,
    val heartMin: Double? = null,
    val heartMax: Double? = null,
)

internal data class HealthOverview(
    val days: List<HealthDay>,
    val latestHeartRate: Double?,
    val latestHeartAt: Instant?,
) {
    val today get() = days.last()
    val latestSleep get() = days.lastOrNull { it.longestSleepHours != null }
}

/** Only observed readings; no synthetic zeros, goals, recovery scores or diagnoses. */
internal fun buildHealthOverview(
    records: List<HealthRecord>, today: LocalDate, zone: ZoneId, now: Instant,
): HealthOverview {
    val first = today.minusDays(6)
    val unique = records.distinctBy { it.type to it.id }
    val heart = sortedMapOf<Instant, Double>()
    for (record in unique.filter { it.type == "heart_rate" }) {
        val readings = record.values["samples"] as? List<*> ?: continue
        for (reading in readings) {
            val sample = reading as? Map<*, *> ?: continue
            val bpm = validHealthNumber(sample["beatsPerMinute"])?.takeIf { it in 1.0..300.0 } ?: continue
            val instant = runCatching { Instant.parse(sample["time"] as? String ?: "") }.getOrNull() ?: continue
            if (!instant.isAfter(now) && instant.atZone(zone).toLocalDate() in first..today) {
                heart[instant] = bpm
            }
        }
    }
    val heartByDay = heart.entries.groupBy { it.key.atZone(zone).toLocalDate() }
    val days = (0L..6L).map { offset ->
        val day = first.plusDays(offset)
        val start = day.atStartOfDay(zone).toInstant()
        val end = minOf(day.plusDays(1).atStartOfDay(zone).toInstant(), now)
        fun dailyValue(type: String, key: String): Double? = unique
            .filter { it.type == type && it.startTime.atZone(zone).toLocalDate() == day }
            .mapNotNull { validHealthNumber(it.values[key]) }
            .maxOrNull()
        // Merge overlapping exercise intervals rather than counting simultaneous records twice.
        val intervals = unique.asSequence().filter { it.type == "exercise" }
            .map { maxOf(it.startTime, start) to minOf(it.endTime, end) }
            .filter { it.second.isAfter(it.first) }.sortedBy { it.first }.toList()
        var seconds = 0L
        var coveredUntil = start
        for ((from, to) in intervals) {
            if (to.isAfter(coveredUntil)) {
                seconds += Duration.between(maxOf(from, coveredUntil), to).seconds
                coveredUntil = to
            }
        }
        val sleep = unique.filter {
            it.type == "sleep" && !it.endTime.isAfter(now) && it.endTime.atZone(zone).toLocalDate() == day
        }.mapNotNull { validHealthNumber(it.values["hours"])?.takeIf { hours -> hours in 0.0..24.0 } }.maxOrNull()
        val samples = heartByDay[day].orEmpty().map { it.value }
        HealthDay(day, dailyValue("steps", "count"), dailyValue("calories", "kilocalories"),
            if (intervals.isEmpty()) null else seconds / 60.0,
            sleep, samples.minOrNull(), samples.maxOrNull())
    }
    return HealthOverview(days, heart.entries.lastOrNull()?.value, heart.entries.lastOrNull()?.key)
}
