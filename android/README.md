# Murim para Android

<<<<<<< HEAD
Aplicativo Kotlin/Jetpack Compose para ler dados autorizados do Health Connect e sincronizá-los com Nitro/PostgreSQL (Neon).

## Fluxo

- `AuthRepository`: obtém o client ID público em /api/mobile/config e envia o Google ID token ao Better Auth do site.
- `TokenStore`: mantém a sessão em armazenamento local criptografado; o usuário antigo Firebase precisa entrar novamente.
- `HealthConnectManager`: lê passos, calorias, sono, sessões de exercício e FC conforme permissões.
- `SyncRepository` e `NativeApi`: enviam lotes de até 25 atividades/métricas para /api/saude/health-connect usando HTTPS e a sessão autenticada. FC isolada não se torna treino.
- `SyncWorker`: sincronização periódica a cada seis horas quando há autorização de leitura em segundo plano e conexão.
- Acompanhe o status em Relatórios → Sincronização no site. Registros anteriores do Firebase não são migrados nem excluídos automaticamente.

## Compilar

Requisitos: JDK 17, Android SDK 35, Gradle wrapper do projeto. O pacote de release é `com.dnl8.fitnessrpg`. O APK de debug usa `com.dnl8.fitnessrpg.debug`.

No Windows, dentro de android:
=======
O aplicativo usa Kotlin e Jetpack Compose. Ele lê dados do Health Connect e sincroniza métricas e atividades com a API Nitro do App-fitness, que persiste os dados no Postgres.

- O Android busca o identificador OAuth em `/api/mobile/config`. O Google Sign-In fornece um ID token ao Better Auth, e o cookie de sessão é guardado em armazenamento local criptografado.
- A sincronização manual consulta os últimos 30 dias, conforme as permissões concedidas. O WorkManager agenda uma execução a cada seis horas quando há permissão de leitura em segundo plano e conexão de rede.
- O Android envia métricas e atividades à rota autenticada `POST /api/saude/health-connect`. A API preserva as métricas omitidas e deduplica atividades já importadas. Amostras de frequência cardíaca complementam sessões de exercício.

## Compilar e executar

Requisitos: Android SDK 35 e JDK 17 ou superior. O projeto usa Gradle 9.6.0, Android Gradle Plugin 9.5.2 e Kotlin 2.2.10.

No Windows, na pasta `android/`:
>>>>>>> 7aaa789 (quase pronto)

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:installDebug
```

No Linux/macOS: `./gradlew :app:assembleDebug`. APK em `app/build/outputs/apk/debug/app-debug.apk`.

Configure JAVA_HOME e ANDROID_HOME (ou sdk.dir) quando necessário.

## OAuth e teste real

Registre o package e SHA-1 do certificado de assinatura no projeto Google OAuth correspondente ao client web do Murim. O APK aponta para https://murim-iota.vercel.app por padrão. Para usar outro ambiente, defina `FITNESS_API_ORIGIN` ou passe `-PfitnessApiOrigin=https://seu-app.example` ao Gradle. Entre com a mesma conta Google que usa no site; conceda as permissões Health Connect e execute a sincronização. Confirme o resultado no site e a ausência de duplicidades. A compilação CI não garante autenticação nem sincronização real no dispositivo.

<<<<<<< HEAD
O usuário pode revogar permissões no Health Connect; backup automático Android está desativado. O Android sincroniza com a API Nitro usando a sessão do Better Auth.

[Integrações](../docs/integracoes-nuxt.md)
=======
A compilação usa `https://murim-iota.vercel.app` por padrão. Para apontar o APK para outra instância, configure `FITNESS_API_ORIGIN` no ambiente ou passe `-PfitnessApiOrigin=https://seu-app.example` ao Gradle. Use uma origem HTTPS compatível com a configuração de autenticação do servidor.

## Health Connect e privacidade

O aplicativo solicita permissões para passos, calorias, treinos, sono e frequência cardíaca; o usuário controla quais tipos autoriza. A leitura em segundo plano requer suporte do provedor e autorização adicional. O usuário pode revogar as permissões nas configurações do Health Connect.

Consulte **Privacidade do Health Connect** no aplicativo para obter os detalhes da coleta e sincronização. O backup automático do Android permanece desativado para evitar cópias não intencionais dos dados locais de saúde.
>>>>>>> 7aaa789 (quase pronto)
