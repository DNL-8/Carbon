# Hospedagem no Google Cloud Run

Opção de hospedagem do Carbon com dois serviços Cloud Run em São Paulo e PostgreSQL Neon. O frontend público apresenta a tela de login; somente contas Google previamente provisionadas podem entrar. O backend não aceita invocação anônima. O Next.js usa a identidade de sua conta de serviço para chamar o FastAPI quando MURIM_CLOUD_RUN_IAM=true. A configuração padrão local/Vercel continua disponível.

## Antes de executar

Crie ou selecione um projeto em https://console.cloud.google.com/ com faturamento habilitado e configure um alerta de orçamento (alertas não são limites rígidos). Instale a CLI gcloud, faça login com `gcloud auth login` e confirme a conta e o ID exato do projeto. Não use um projeto desconhecido nem credenciais no Git. Use um checkout limpo de uma revisão com CI aprovada; os comandos abaixo são PowerShell na raiz desse checkout. A CLI pode exigir permissões para Cloud Build, Artifact Registry, IAM e Cloud Run. Não conceda Editor a contas de execução para contornar erros.

```powershell
$Project = 'SEU_PROJECT_ID'
$Region = 'southamerica-east1'
gcloud config set project $Project
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=$Project
gcloud iam service-accounts create carbon-web --project=$Project
gcloud iam service-accounts create carbon-api --project=$Project
$WebSA = "carbon-web@$Project.iam.gserviceaccount.com"
$ApiSA = "carbon-api@$Project.iam.gserviceaccount.com"
```

Crie as contas apenas uma vez. Confira cada comando antes de prosseguir. Use contas separadas para execução e build. O ambiente não deve conter dados de saúde reais durante a homologação.

## Publicar a API privada e a web

O Dockerfile existente da API usa porta 8000. O Dockerfile da raiz usa o contexto do monorepo e porta 8080. A implantação inicial não recebe credenciais, e ENABLE_WRITES=false impede escritas. Confirme o projeto de destino e os custos antes de executar. Não execute estes comandos contra um serviço de produção existente sem verificar o impacto.

```powershell
gcloud run deploy carbon-api --project=$Project --region=$Region --source=backend --port=8000 --service-account=$ApiSA --no-allow-unauthenticated --cpu=1 --memory=512Mi --min-instances=0 --max-instances=2 --concurrency=8 --timeout=60 --set-env-vars=ENABLE_WRITES=false
$ApiUrl = (gcloud run services describe carbon-api --project=$Project --region=$Region --format="value(status.url)").Trim()
gcloud run services add-iam-policy-binding carbon-api --project=$Project --region=$Region --member="serviceAccount:$WebSA" --role=roles/run.invoker
gcloud run deploy carbon-web --project=$Project --region=$Region --source=. --port=8080 --service-account=$WebSA --allow-unauthenticated --cpu=1 --memory=1Gi --min-instances=0 --max-instances=2 --concurrency=8 --timeout=60 --set-env-vars="MURIM_FASTAPI_ORIGIN=$ApiUrl,MURIM_CLOUD_RUN_IAM=true"
$WebUrl = (gcloud run services describe carbon-web --project=$Project --region=$Region --format="value(status.url)").Trim()
```

O frontend tem URL pública para login, mas a API exige IAM. Não conceda allUsers ou allAuthenticatedUsers à API. A região, memória e limites de instâncias são escolhas iniciais, não garantia de custo zero. Verifique o IAM do serviço e que não há invocadores indevidos.

## Configurar segredos e OAuth

No Secret Manager crie os segredos `carbon-database-url` (conexão pooled TLS do banco carbon, nunca neondb legado), `carbon-google-client-id`, `carbon-google-client-secret`, `carbon-google-users` (JSON de sub Google verificado para ID interno distinto) e `carbon-python-auth-secret` (aleatório, >=32 caracteres). Crie versões diretamente na interface do Google, não no Git ou no chat. Conceda à conta carbon-api somente roles/secretmanager.secretAccessor em cada segredo individual. Confira o schema e o provisionamento conforme [autenticação](python-auth-cutover.md) e [Neon](neon-postgresql.md). Não rode bootstrap em banco existente. Use versões numeradas para uma revisão reprodutível; o exemplo pressupõe que cada segredo tem versão 1.

```powershell
gcloud run services update carbon-api --project=$Project --region=$Region --update-env-vars="APP_ORIGIN=$WebUrl,ENABLE_WRITES=false" --update-secrets="DATABASE_URL=carbon-database-url:1,GOOGLE_CLIENT_ID=carbon-google-client-id:1,GOOGLE_CLIENT_SECRET=carbon-google-client-secret:1,GOOGLE_USERS=carbon-google-users:1,PYTHON_AUTH_SECRET=carbon-python-auth-secret:1"
```

No Google OAuth web, cadastre $WebUrl como origem e $WebUrl/api/auth/callback/google como callback. Configure as contas permitidas conforme o fluxo existente; o login não cria usuários. Gemini e Strava são opcionais e devem ser configurados como segredos específicos, usando o callback Strava na origem web. Não reutilize credenciais de produção em testes.

## Aceite

- Teste a URL direta da API sem identidade: deve ser recusada pelo IAM.
- Pela web, GET /api/health deve responder 200 e GET /api/ready deve confirmar readiness após configurar credenciais. Readiness inicial pode retornar 503.
- Confirme login das duas contas, recusa de terceira conta e isolamento, conforme [homologação](homologacao.md).
- Antes de habilitar ENABLE_WRITES=true, valide backups, banco de homologação, origem e credenciais. Somente depois teste dados sintéticos.
- Compile o APK com a origem HTTPS da web, e valide Health Connect em dispositivo físico.
- Configure retenção de logs sem conteúdo de saúde, alertas de custo e limpeza de imagens antigas em Artifact Registry. Não apague a hospedagem Vercel anterior enquanto não houver aceite.

Referências: [Cloud Run: implantação por código-fonte](https://cloud.google.com/run/docs/deploying-source-code), [autenticação serviço a serviço](https://cloud.google.com/run/docs/authenticating/service-to-service).
