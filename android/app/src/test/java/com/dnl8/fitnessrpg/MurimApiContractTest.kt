package com.dnl8.fitnessrpg

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class MurimApiContractTest {
    private val origin = "https://murim-ci.example.test"

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
