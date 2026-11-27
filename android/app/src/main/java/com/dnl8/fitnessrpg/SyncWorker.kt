package com.dnl8.fitnessrpg

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import kotlinx.coroutines.CancellationException
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
            return Result.success()
        }
        return try {
            TokenStore.initialize(applicationContext)

            val authRepository = AuthRepository(applicationContext)
            if (!authRepository.isSignedIn()) return Result.success()
            val session = TokenStore.getSessionCookie() ?: return Result.success()

            val healthConnect = HealthConnectManager(applicationContext)
            if (!healthConnect.canReadInBackground()) return Result.success()

            val syncRepository = SyncRepository(authRepository)
            syncRepository.syncRecords(healthConnect.readRecentRecords(), session)
            Result.success()
        } catch (error: CancellationException) {
            throw error
        } catch (_: SecurityException) {
            Result.success()
        } catch (_: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
