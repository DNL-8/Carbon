package com.dnl8.fitnessrpg

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection

/** Same-origin HTTPS only; never follow redirects or expose auth headers in logs. */
object NativeApi {
    private val origin = BuildConfig.FITNESS_API_ORIGIN.trimEnd('/')
    data class Response(val body: JSONObject, val sessionCookie: String?)
    class HttpError(val status: Int) : IllegalStateException("Servidor retornou HTTP $status.")

    suspend fun request(path: String, method: String = "GET", body: JSONObject? = null, authenticated: Boolean = true): Response =
        withContext(Dispatchers.IO) {
            val connection = MurimApiContract.target(origin, path).openConnection() as HttpURLConnection
            val cookie = if (authenticated) TokenStore.getSessionCookie() ?: error("Entre novamente na sua conta.") else null
            try {
                connection.instanceFollowRedirects = false
                connection.requestMethod = method
                connection.connectTimeout = 10_000
                connection.readTimeout = 20_000
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Origin", origin)
                if (cookie != null) connection.setRequestProperty("Cookie", cookie)
                if (body != null) {
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                if (status !in 200..299) {
                    if (authenticated && status == 401 && TokenStore.getSessionCookie() == cookie) TokenStore.clear()
                    throw HttpError(status)
                }
                val nextCookie = MurimApiContract.sessionCookie(connection.headerFields)
                if (authenticated && nextCookie != null && TokenStore.getSessionCookie() == cookie) TokenStore.saveSessionCookie(nextCookie)
                val text = connection.inputStream.bufferedReader().use { it.readText() }
                Response(if (text.isBlank()) JSONObject() else JSONObject(text), nextCookie)
            } finally { connection.disconnect() }
        }
}
