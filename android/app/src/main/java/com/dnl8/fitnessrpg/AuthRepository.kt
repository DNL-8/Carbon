package com.dnl8.fitnessrpg

import android.content.Context
import org.json.JSONObject
import java.util.Date

/** Native Google ID token is verified by the same Better Auth instance as the website. */
class AuthRepository(private val context: Context) {
    suspend fun googleClientId(): String {
        val id = NativeApi.request("/api/mobile/config", authenticated = false).body.getString("googleClientId")
        require(id.endsWith(".apps.googleusercontent.com"))
        return id
    }
    suspend fun signInWithGoogleIdToken(idToken: String): AuthResult {
        return try {
            val response = NativeApi.request("/api/auth/sign-in/social", "POST", JSONObject()
                .put("provider", "google")
                .put("idToken", JSONObject().put("token", idToken)), authenticated = false)
            val user = response.body.getJSONObject("user")
            val cookie = response.sessionCookie ?: error("Sessão não retornada.")
            check(user.optBoolean("emailVerified"))
            TokenStore.saveAuthData(
                uid = user.getString("id"), email = user.optString("email"),
                displayName = user.optString("name"), photoUrl = user.optString("image"),
                isSignedIn = true, lastSignIn = Date()
            )
            TokenStore.saveSessionCookie(cookie)
            AuthResult(true, "Login concluído no Murim.")
        } catch (_: Exception) {
            TokenStore.clear()
            AuthResult(false, "Não foi possível autenticar no Murim. Confira a configuração Google do aplicativo.")
        }
    }
    suspend fun signOut() {
        try { if (isSignedIn()) NativeApi.request("/api/auth/sign-out", "POST", JSONObject()) }
        catch (_: Exception) { /* Local session is always cleared. */ }
        finally { TokenStore.clear() }
    }
    fun isSignedIn(): Boolean = TokenStore.isAuthenticated() && !TokenStore.getSessionCookie().isNullOrBlank()
    fun getCurrentUserId(): String? = if (isSignedIn()) TokenStore.getUserId() else null
    fun getCurrentEmail(): String? = if (isSignedIn()) TokenStore.getEmail() else null
}
data class AuthResult(val success: Boolean, val message: String)
