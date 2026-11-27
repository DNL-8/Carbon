package com.dnl8.fitnessrpg

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.Date

/**
 * Armazenamento seguro para dados de autenticação.
 * Usa EncryptedSharedPreferences para proteger os dados em repouso.
 */
object TokenStore {
    private const val PREFS_NAME = "fitness_rpg_secure_prefs"
    private const val KEY_SESSION_COOKIE = "better_auth_session_cookie"
    private const val KEY_UID = "user_uid"
    private const val KEY_EMAIL = "user_email"
    private const val KEY_DISPLAY_NAME = "user_display_name"
    private const val KEY_PHOTO_URL = "user_photo_url"
    private const val KEY_IS_SIGNED_IN = "is_signed_in"
    private const val KEY_LAST_SIGN_IN = "last_sign_in"

    @Volatile private var prefs: SharedPreferences? = null

    // Checkpoint stays in the encrypted preferences and is removed on logout.
    fun healthCheckpoint(account: String, scope: String, day: String): String? {
        if (getUserId() != account) return null
        val key = "hc_checkpoint:$account:$scope"
        val value = prefs?.getString(key, null) ?: return null
        return checkpointForDay(value, day)
    }

    @Synchronized
    fun saveHealthCheckpoint(account: String, session: String, scope: String, day: String, token: String) {
        check(getUserId() == account && getSessionCookie() == session) { "A conta foi alterada durante a sincronização." }
        val storage = checkNotNull(prefs)
        check(storage.edit().putString("hc_checkpoint:$account:$scope", "$day\n$token").commit()) {
            "Não foi possível guardar o checkpoint do Health Connect."
        }
    }

    @Synchronized
    fun initialize(context: Context) {
        if (prefs != null) return
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context.applicationContext,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Salva os dados da conta autenticada no Murim.
     */
    @Synchronized
    fun saveAuthData(
        uid: String,
        email: String,
        displayName: String,
        photoUrl: String,
        sessionCookie: String,
        isSignedIn: Boolean,
        lastSignIn: Date
    ) {
        prefs?.edit()
            ?.putString(KEY_UID, uid)
            ?.putString(KEY_EMAIL, email)
            ?.putString(KEY_DISPLAY_NAME, displayName)
            ?.putString(KEY_PHOTO_URL, photoUrl)
            ?.putString(KEY_SESSION_COOKIE, sessionCookie)
            ?.putBoolean(KEY_IS_SIGNED_IN, isSignedIn)
            ?.putLong(KEY_LAST_SIGN_IN, lastSignIn.time)
            ?.apply()
    }

    @Synchronized
    fun replaceSessionIfCurrent(expected: String, cookie: String) {
        if (getSessionCookie() == expected) prefs?.edit()?.putString(KEY_SESSION_COOKIE, cookie)?.apply()
    }

    @Synchronized
    fun clearIfSession(expected: String) {
        if (getSessionCookie() == expected) clear()
    }
    fun getSessionCookie(): String? = prefs?.getString(KEY_SESSION_COOKIE, null)

    fun getUserId(): String? = prefs?.getString(KEY_UID, null)

    fun getEmail(): String? = prefs?.getString(KEY_EMAIL, null)

    fun getDisplayName(): String? = prefs?.getString(KEY_DISPLAY_NAME, null)

    fun getPhotoUrl(): String? = prefs?.getString(KEY_PHOTO_URL, null)

    fun getLastSignInTime(): Date? = prefs?.getLong(KEY_LAST_SIGN_IN, 0L)?.takeIf { it > 0 }?.let { Date(it) }

    @Synchronized
    fun clear() {
        prefs?.edit()?.clear()?.apply()
    }

    fun isAuthenticated(): Boolean =
        preferencesNotNull() &&
        prefs?.getBoolean(KEY_IS_SIGNED_IN, false) == true &&
        !prefs?.getString(KEY_UID, null).isNullOrBlank()

    private fun preferencesNotNull(): Boolean = prefs != null
}
