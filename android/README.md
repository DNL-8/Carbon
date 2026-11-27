# Murim para Android

O aplicativo Kotlin e Jetpack Compose lê dados autorizados no Health Connect e os sincroniza com a API FastAPI. O PostgreSQL guarda os registros por conta.

- O aplicativo obtém o client ID OAuth público em `/api/mobile/config` e envia o ID token do Google ao FastAPI. O cookie de sessão fica em armazenamento local criptografado.
- A sincronização manual consulta os últimos 30 dias. As calorias diárias representam apenas energia ativa, sem metabolismo basal. Após atualizar o APK, conceda a permissão de calorias ativas no Health Connect. Valores históricos importados por versões anteriores podem representar calorias totais; a nova sincronização substitui somente os dias com medições ativas disponíveis, sem apagar os demais registros. O WorkManager pode executar a sincronização a cada seis horas quando há conexão e permissão para ler em segundo plano.
- A API recebe lotes de até 25 atividades e 25 métricas diárias. Ela deduplica atividades e preserva os valores de métricas omitidas. Amostras de frequência cardíaca complementam sessões de exercício. Medições diárias ausentes ou inválidas são omitidas. O contrato legado de atividades ainda envia zeros para distância, calorias, elevação e zonas não coletadas; o relatório web trata esses zeros do Health Connect como indisponíveis, sem reescrever o histórico.
- Consulte os resultados em **Saúde → Sincronização**. O usuário pode revogar permissões no Health Connect. O backup automático do aplicativo Android está desativado.

## Compilar

Use JDK 17, Android SDK 35 e o Gradle wrapper do projeto. O pacote de release é `com.dnl8.fitnessrpg`. O pacote de debug termina em `.debug`.

No Windows, dentro de android:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug
```

No Linux ou macOS, use `./gradlew :app:testDebugUnitTest :app:assembleDebug`. O APK é gerado em `app/build/outputs/apk/debug/app-debug.apk`. Configure `JAVA_HOME` e `ANDROID_HOME` se necessário.

## Homologar em aparelho físico

1. Registre no projeto Google Cloud o package e o SHA-1 da assinatura do APK instalado. Use o client web do mesmo projeto no FastAPI.
2. Compile com `-PfitnessApiOrigin=https://seu-app.example` ou configure `FITNESS_API_ORIGIN` para a origem HTTPS usada também em `APP_ORIGIN`.
3. Entre com cada conta autorizada. Importe dados com permissões integrais e parciais e confira os resultados em **Saúde**. Repita a importação e confirme a deduplicação.
4. Valide a sincronização em segundo plano, a revogação de permissões e a troca de conta durante a coleta.

O build e os testes unitários verificam o APK e o contrato HTTP. A homologação acima requer um dispositivo físico. [Configuração OAuth](../docs/python-auth-cutover.md)
