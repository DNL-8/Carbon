package com.dnl8.fitnessrpg

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class MurimApiContractTest {
    private val origin = "https://murim-ci.example.test"

    @Test
    fun checkpointRequiresSameDayAndNoPendingChanges() {
        assertEquals("token", checkpointForDay("day1\ntoken", "day1"))
        assertNull(checkpointForDay("day1\ntoken", "day2"))
        assertNull(checkpointForDay("day1\n", "day1"))
        assertNull(checkpointForDay(null, "day1"))
        assertEquals("next", reusableChangesToken(false, false, false, "next"))
        assertNull(reusableChangesToken(true, false, false, "next"))
        assertNull(reusableChangesToken(false, true, false, "next"))
        assertNull(reusableChangesToken(false, false, true, "next"))
        assertNull(reusableChangesToken(false, false, false, ""))
    }

    @Test
    fun missingDailyMeasurementIsNotZero() {
        assertNull(validHealthNumber(null))
        assertNull(validHealthNumber("0"))
        assertNull(validHealthNumber(Double.NaN))
        assertNull(validHealthNumber(Double.POSITIVE_INFINITY))
        assertNull(validHealthNumber(-1))
        assertEquals(0.0, validHealthNumber(0)!!, 0.0)
        assertEquals(12.5, validHealthNumber(12.5)!!, 0.0)
    }

    @Test
    fun healthConnectUsesThePublicGateway() {
        val url = MurimApiContract.target(origin, MurimApiContract.HEALTH_CONNECT_PATH)
        assertEquals("https", url.protocol)
        assertEquals("murim-ci.example.test", url.host)
        assertEquals("/api/saude/health-connect", url.path)
        assertThrows(IllegalArgumentException::class.java) {
            MurimApiContract.target(origin, "/api/../auth")
        }
        assertThrows(IllegalArgumentException::class.java) {
            MurimApiContract.target(origin, "https://elsewhere.example.test/api")
        }
    }

    @Test
    fun sessionRefreshUsesOnlyTheBetterAuthCookie() {
        val headers = mapOf(
            null to listOf("HTTP/1.1 200 OK"),
            "set-cookie" to listOf(
                "murim_strava_session=example; Secure; HttpOnly",
                "__Secure-better-auth.session_token=renewed; Secure; HttpOnly",
            ),
        )
        assertEquals("__Secure-better-auth.session_token=renewed", MurimApiContract.sessionCookie(headers))
        assertNull(MurimApiContract.sessionCookie(mapOf(
            "Set-Cookie" to listOf("better-auth.session_token=", "better-auth.session_token=bad\r\nvalue"),
        )))
    }
}
