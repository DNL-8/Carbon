package com.dnl8.fitnessrpg

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.*
import org.junit.Test

class HealthOverviewTest {
    private val day = LocalDate.parse("2026-11-27")
    private val now = Instant.parse("2026-11-27T20:00:00Z")
    private fun record(id: String, type: String, start: String, end: String, values: Map<String, Any> = emptyMap()) =
        HealthRecord(id, type, Instant.parse(start), Instant.parse(end), values)

    @Test fun absentMeasurementsRemainAbsentAndMeasuredZeroIsKept() {
        val empty = buildHealthOverview(emptyList(), day, ZoneOffset.UTC, now)
        assertEquals(7, empty.days.size)
        assertNull(empty.today.steps)
        assertNull(empty.today.calories)
        assertNull(empty.today.exerciseMinutes)
        assertNull(empty.latestHeartRate)
        val steps = record("s", "steps", "2026-11-27T00:00:00Z", "2026-11-28T00:00:00Z", mapOf("count" to 0))
        val data = buildHealthOverview(listOf(steps), day, ZoneOffset.UTC, now)
        assertEquals(0.0, data.today.steps!!, 0.0)
        assertNull(data.today.calories)
    }

    @Test fun overlappingExercisesDoNotDoubleCountAndSleepUsesLongestSession() {
        val records = listOf(
            record("a", "exercise", "2026-11-27T10:00:00Z", "2026-11-27T11:00:00Z"),
            record("b", "exercise", "2026-11-27T10:30:00Z", "2026-11-27T11:30:00Z"),
            record("c", "sleep", "2026-11-26T23:00:00Z", "2026-11-27T06:00:00Z", mapOf("hours" to 7)),
            record("d", "sleep", "2026-11-27T01:00:00Z", "2026-11-27T06:00:00Z", mapOf("hours" to 5)),
        )
        val data = buildHealthOverview(records, day, ZoneOffset.UTC, now)
        assertEquals(90.0, data.today.exerciseMinutes!!, 0.0)
        assertEquals(7.0, data.latestSleep!!.longestSleepHours!!, 0.0)
    }

    @Test fun heartRangeUsesOnlyValidObservedSamples() {
        val samples = listOf(
            mapOf("time" to "2026-11-27T10:00:00Z", "beatsPerMinute" to 62),
            mapOf("time" to "2026-11-27T11:00:00Z", "beatsPerMinute" to 85),
            mapOf("time" to "2026-11-27T12:00:00Z", "beatsPerMinute" to -1),
            mapOf("time" to "2026-11-28T12:00:00Z", "beatsPerMinute" to 100),
        )
        val hr = record("h", "heart_rate", "2026-11-27T10:00:00Z", "2026-11-27T12:00:00Z", mapOf("samples" to samples))
        val data = buildHealthOverview(listOf(hr), day, ZoneOffset.UTC, now)
        assertEquals(62.0, data.today.heartMin!!, 0.0)
        assertEquals(85.0, data.today.heartMax!!, 0.0)
        assertEquals(85.0, data.latestHeartRate!!, 0.0)
    }
}
