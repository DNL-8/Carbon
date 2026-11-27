package com.dnl8.fitnessrpg

import java.net.URL

internal object MurimApiContract {
    const val HEALTH_CONNECT_PATH = "/api/saude/health-connect"

    fun target(origin: String, path: String): URL {
        require(origin.startsWith("https://") && path.startsWith("/api/") && !path.contains(".."))
        return URL(origin + path)
    }

    fun sessionCookie(headers: Map<String?, List<String>>): String? = headers.entries
        .filter { it.key?.equals("Set-Cookie", ignoreCase = true) == true }
        .flatMap { it.value }
        .map { it.substringBefore(';').trim() }
        .firstOrNull { value ->
            val sessionToken = value.startsWith("__Secure-better-auth.session_token=") ||
                value.startsWith("better-auth.session_token=")
            sessionToken && value.substringAfter('=').isNotBlank() &&
                value.length < 4096 && value.none { it == '\r' || it == '\n' }
        }
}
