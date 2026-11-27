package com.dnl8.fitnessrpg

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import kotlinx.coroutines.CancellationException
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.sync.withLock
import java.time.LocalDate
import java.time.ZoneId

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

            healthSyncMutex.withLock {
                val authRepository = AuthRepository(applicationContext)
                if (!authRepository.isSignedIn()) return Result.success()
                val session = TokenStore.getSessionCookie() ?: return Result.success()

                val healthConnect = HealthConnectManager(applicationContext)
                if (!healthConnect.canReadInBackground()) return Result.success()

                val account = authRepository.getCurrentUserId() ?: return Result.success()
                val types = healthConnect.changeScope()
                if (types.isEmpty()) return Result.success()
                val scope = types.map { it.simpleName.orEmpty() }.sorted().joinToString(",")
                val zone = ZoneId.systemDefault()
                val day = "${LocalDate.now(zone)}@$zone"
                val previous = TokenStore.healthCheckpoint(account, scope, day)
                val unchanged = previous?.let { healthConnect.unchangedToken(it) }
                if (unchanged != null) {
                    check(healthConnect.changeScope() == types)
                    TokenStore.saveHealthCheckpoint(account, session, scope, day, unchanged)
                    return Result.success()
                }

                // Capture BEFORE reading: changes during the refresh remain visible on the next run.
                val next = healthConnect.freshChangesToken(types)
                val records = healthConnect.readRecentRecords()
                check(authRepository.getCurrentUserId() == account && TokenStore.getSessionCookie() == session)
                SyncRepository(authRepository).syncRecords(records, session)
                check(healthConnect.changeScope() == types)
                TokenStore.saveHealthCheckpoint(account, session, scope, day, next)
                Result.success()
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: SecurityException) {
            Result.success()
        } catch (_: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
