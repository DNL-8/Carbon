package com.dnl8.fitnessrpg

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.Alignment
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    private var healthConnectStatus by mutableIntStateOf(HealthConnectClient.SDK_UNAVAILABLE)
    private var resumeCount by mutableIntStateOf(0)
    private val authRepository by lazy { AuthRepository(this) }

    override fun onResume() {
        super.onResume()
        resumeCount++
        healthConnectStatus = HealthConnectClient.getSdkStatus(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        TokenStore.initialize(this)

        setContent {
            var isLoggedIn by remember { mutableStateOf(authRepository.isSignedIn()) }
            var googleConfigurationError by remember { mutableStateOf(false) }
            var hasHealthPermissions by remember { mutableStateOf(false) }
            var isSigningIn by remember { mutableStateOf(false) }
            var isSyncing by remember { mutableStateOf(false) }
            var message by remember {
                mutableStateOf(
                    if (authRepository.isSignedIn()) {
                        val email = authRepository.getCurrentEmail().orEmpty()
                        if (email.isNotBlank()) "Logado como $email." else "Sessão ativa."
                    } else {
                        ""
                    }
                )
            }
            val healthConnectAvailable = healthConnectStatus == HealthConnectClient.SDK_AVAILABLE
            val scope = rememberCoroutineScope()
            val syncExceptionHandler = CoroutineExceptionHandler { _, throwable ->
                isSyncing = false
                message = "Falha na sincronização: ${throwable.message}"
            }
            val permissionsLauncher = rememberLauncherForActivityResult(
                PermissionController.createRequestPermissionResultContract(),
            ) { granted ->
                val grantedCount = HealthConnectManager.permissions.count { it in granted }
                hasHealthPermissions = grantedCount > 0
                message = when (grantedCount) {
                    0 -> "Nenhuma permissão do Health Connect foi concedida."
                    HealthConnectManager.permissions.size -> "Permissões concedidas. Toque em sincronizar."
                    else -> "Permissões parciais ($grantedCount/${HealthConnectManager.permissions.size}). Somente os dados autorizados serão sincronizados."
                }
            }
            val healthConnect = remember(healthConnectAvailable) {
                if (healthConnectAvailable) HealthConnectManager(this@MainActivity) else null
            }
            LaunchedEffect(healthConnect, resumeCount, isLoggedIn) {
                hasHealthPermissions = isLoggedIn && healthConnect?.hasReadPermission() == true
            }
            val backgroundLauncher = rememberLauncherForActivityResult(
                PermissionController.createRequestPermissionResultContract(),
            ) { granted ->
                message = if (HealthConnectManager.backgroundPermission in granted) {
                    "Permissão em segundo plano concedida. Faça uma sincronização manual para ativá-la."
                } else {
                    "A sincronização em segundo plano está desativada."
                }
            }
            val googleLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult(),
            ) { result ->
                if (result.resultCode == Activity.RESULT_CANCELED && result.data == null) {
                    isSigningIn = false
                    message = "Login com Google cancelado."
                    return@rememberLauncherForActivityResult
                }
                GoogleSignIn.getSignedInAccountFromIntent(result.data)
                    .addOnSuccessListener { account ->
                        val idToken = account.idToken
                        if (idToken.isNullOrBlank()) {
                            isSigningIn = false
                            message = "Não foi possível obter o token do Google."
                        } else {
                            message = "Validando sessão..."
                            scope.launch {
                                val authResult = authRepository.signInWithGoogleIdToken(idToken)
                                isLoggedIn = authRepository.isSignedIn()
                                isSigningIn = false
                                message = if (authResult.success) {
                                    val email = authRepository.getCurrentEmail().orEmpty()
                                    if (email.isNotBlank()) "Logado como $email." else authResult.message
                                } else {
                                    authResult.message
                                }
                            }
                        }
                    }
                    .addOnFailureListener { error ->
                        isSigningIn = false
                        message = when ((error as? ApiException)?.statusCode) {
                            CommonStatusCodes.CANCELED,
                            GoogleSignInStatusCodes.SIGN_IN_CANCELLED -> "Login com Google cancelado."
                            CommonStatusCodes.DEVELOPER_ERROR -> {
                                googleConfigurationError = true
                                "O Google não reconheceu esta versão do app. O cadastro OAuth precisa ser revisado (código 10)."
                            }
                            else -> "Não foi possível entrar com Google. Tente novamente."
                        }
                    }
            }

            val accountAction: () -> Unit = {
                if (isLoggedIn) {
                    scope.launch {
                        authRepository.signOut()
                        WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health-connect-sync")
                        isLoggedIn = false
                        message = "Logout concluído."
                    }
                } else {
                    googleConfigurationError = false
                    isSigningIn = true
                    message = "Abrindo login com Google..."
                    scope.launch {
                        try {
                            val clientId = authRepository.googleClientId()
                            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                .requestIdToken(clientId)
                                .requestEmail()
                                .build()
                            googleLauncher.launch(GoogleSignIn.getClient(this@MainActivity, options).signInIntent)
                        } catch (_: Exception) {
                            isSigningIn = false
                            message = "Google não está configurado no servidor Murim ou a conexão falhou."
                        }
                    }
                }
            }
            val syncAction: () -> Unit = {
                isSyncing = true
                message = "Lendo dados do Health Connect..."
                scope.launch(syncExceptionHandler) {
                    try {
                        val manager = checkNotNull(healthConnect)

                        // Leitura dos dados com timeout de 60 segundos para evitar travamento infinito
                        val records = withTimeoutOrNull(60_000L) {
                            manager.readRecentRecords()
                        } ?: run {
                            message = "Tempo esgotado ao ler dados do Health Connect. Tente novamente."
                            isSyncing = false
                            return@launch
                        }

                        if (records.isEmpty()) {
                            message = "Nenhum registro encontrado no Health Connect nos últimos 30 dias."
                            isSyncing = false
                            return@launch
                        }

                        val syncRepo = SyncRepository(authRepository)
                        val result = withTimeoutOrNull(60_000L) {
                            syncRepo.syncRecords(records) { sent, total ->
                                message = "Sincronizando $sent de $total lotes..."
                            }
                        } ?: run {
                            message = "Tempo esgotado durante a sincronização. Tente novamente."
                            isSyncing = false
                            return@launch
                        }

                        if (manager.canReadInBackground()) {
                            scheduleBackgroundSync()
                        } else {
                            WorkManager.getInstance(this@MainActivity)
                                .cancelUniqueWork("health-connect-sync")
                        }

                        message = if (result.imported + result.duplicates + result.days == 0) {
                            "Nenhum exercício ou métrica diária disponível para sincronizar."
                        } else {
                            "Sincronização concluída: ${result.imported} novas atividades, " +
                                "${result.duplicates} já importadas e ${result.days} dias de métricas processados."
                        }
                    } catch (error: Throwable) {
                        isLoggedIn = authRepository.isSignedIn()
                        message = "Falha na sincronização: ${error.message}"
                    } finally {
                        isSyncing = false
                    }
                }
            }
            MaterialTheme(colorScheme = FitnessColors) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.TopCenter) {
                        Column(
                            modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth()
                                .verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            FitnessHero()

                            if (!isLoggedIn) {
                                FitnessPanel {
                                    Text("Conecte sua conta", style = MaterialTheme.typography.titleLarge)
                                    Text(
                                        "Entre para salvar os dados autorizados na sua conta Fitness RPG.",
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Button(
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                                        enabled = !isSigningIn,
                                        onClick = accountAction,
                                    ) { Text(if (isSigningIn) "Conectando…" else "Entrar com Google") }
                                }
                            }

                            if (isSigningIn || isSyncing) {
                                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                            }
                            if (message.isNotBlank()) {
                                Surface(
                                    modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
                                    shape = RoundedCornerShape(16.dp),
                                    color = if (googleConfigurationError) MaterialTheme.colorScheme.errorContainer
                                        else MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = if (googleConfigurationError) MaterialTheme.colorScheme.onErrorContainer
                                        else MaterialTheme.colorScheme.onSurfaceVariant,
                                ) {
                                    Text(message, Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium)
                                }
                            }

                            FitnessPanel {
                                Text("Health Connect", style = MaterialTheme.typography.titleLarge)
                                Text(
                                    when (healthConnectStatus) {
                                        HealthConnectClient.SDK_UNAVAILABLE -> "Indisponível neste dispositivo."
                                        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                                            "Instale ou atualize o Health Connect para continuar."
                                        else -> if (isLoggedIn) "Autorize os dados que deseja compartilhar e sincronize quando quiser."
                                            else "Depois de entrar, escolha quais dados deseja compartilhar."
                                    },
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    "Atividades, passos, calorias, sono e frequência cardíaca.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (isLoggedIn && healthConnectAvailable) {
                                    if (hasHealthPermissions) {
                                        Button(
                                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                                            enabled = !isSyncing,
                                            onClick = syncAction,
                                        ) { Text(if (isSyncing) "Sincronizando…" else "Sincronizar agora") }
                                    }
                                    OutlinedButton(
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                                        enabled = !isSyncing,
                                        onClick = { permissionsLauncher.launch(HealthConnectManager.permissions) },
                                    ) { Text(if (hasHealthPermissions) "Gerenciar permissões" else "Permitir acesso") }

                                    if (healthConnect?.supportsBackgroundRead == true && hasHealthPermissions) {
                                        TextButton(
                                            enabled = !isSyncing,
                                            onClick = {
                                                backgroundLauncher.launch(setOf(HealthConnectManager.backgroundPermission))
                                            },
                                        ) { Text("Permitir sincronização em segundo plano") }
                                    }
                                    Text(
                                        "Usa Samsung Health? Ative o compartilhamento com Health Connect nas configurações do Samsung Health.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }

                            TextButton(onClick = {
                                startActivity(Intent(this@MainActivity, PermissionsRationaleActivity::class.java))
                            }) { Text(stringResource(R.string.health_connect_privacy_title)) }
                            if (isLoggedIn) {
                                TextButton(enabled = !isSyncing, onClick = accountAction) { Text("Sair da conta") }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun scheduleBackgroundSync() {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "health-connect-sync",
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}