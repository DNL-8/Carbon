# Backend FastAPI do Murim

O FastAPI implementa as 36 combinações de método e rota de negócio do Nitro. Next.js e Authlib estão em homologação; Nuxt e Better Auth permanecem como opção de reversão. O Android usa a mesma origem HTTPS e os mesmos cookies. O Nitro continua disponível para reversão. A [matriz de paridade](PARIDADE.md) indica as evidências por rota e as verificações de homologação.

## Desenvolvimento isolado

1. Use PostgreSQL 18 descartável, com ICU, em loopback. Crie `murim_fastapi_test` com credenciais exclusivas de teste. Da raiz, aplique as oito migrações existentes com `DATABASE_URL_DIRECT=<url-local> bun run db:migrate`.
2. Em `backend/`, execute `uv sync --locked` com Python 3.13. Use `cp .env.example .env` apenas em um checkout de desenvolvimento. Configure `DATABASE_URL` e `AUTH_ORIGIN` para o banco e o serviço Better Auth isolados.
3. Inicie o FastAPI com `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`. `GET /api/health` verifica o processo e `GET /api/ready` verifica a configuração da origem de identidade e a leitura de progresso no banco.
4. Para exercitar o roteamento, configure `NUXT_MURIM_FASTAPI_ORIGIN=http://127.0.0.1:8000` no processo Nuxt e `BETTER_AUTH_URL` com a origem pública daquele Nuxt no FastAPI. Utilize `ENABLE_WRITES=true` para testar mutações. Em HTTPS, mantenha as mesmas configurações públicas usadas pelo Better Auth. O FastAPI envia a renovação de sessão recebida do servidor de identidade.
5. Configure Strava e Gemini com valores de homologação. Para Strava use `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` e `STRAVA_SESSION_SECRET` com a mesma chave dos cookies Nitro e uma origem pública HTTPS. Para o Oráculo use `GEMINI_API_KEY` e `GEMINI_MODEL`. O Oráculo agrega saúde mediante consentimento por solicitação.

O gateway encaminha métodos e caminhos de negócio explicitamente listados. Ele preserva `Cookie`, `Origin`, query string, status, múltiplos `Set-Cookie` e redirects relativos do Strava. A origem do backend vem da configuração privada do Nuxt. Comunicação local usa HTTP em loopback. Outras origens exigem HTTPS. As mutações FastAPI exigem conta verificada, origem pública exata e escrita habilitada. O callback OAuth usa estado autenticado, prazo e associação à conta.

## Schema, adoção e teste

`app/schema.py` mapeia as 17 tabelas existentes, incluindo identidade, chaves, defaults e índices. Alembic adota o estado Drizzle 0007 após comparar metadados com PostgreSQL. A revisão `0001_drizzle_baseline` altera somente o marcador próprio `murim_alembic_version`. Em banco existente, adote o schema Drizzle 0007 completo. Em banco novo e vazio, use `MURIM_BOOTSTRAP_EMPTY=1 uv run --locked alembic upgrade head`, com a URL direta configurada. O baseline congelado cria as 17 tabelas sem Node ou Drizzle; schemas parciais são recusados. Não use a flag em bancos existentes. As próximas revisões devem usar Alembic. Use uma conexão direta exclusiva em `MURIM_MIGRATION_DATABASE_URL`.

Em `backend/`, com as duas URLs de teste apontando para o banco local descartável:

```sh
uv run --locked ruff check .
uv run --locked pytest -q
uv run --locked alembic upgrade head
uv run --locked alembic check
uv run --locked alembic downgrade base
uv run --locked alembic upgrade head
docker build -t murim-fastapi:test .
```

Os oráculos TypeScript são gerados pelos scripts `check-fastapi-*.mjs` e consumidos pelo Pytest via `MURIM_PROGRESSION_ORACLE`, `MURIM_EQUIPMENT_ORACLE` e `MURIM_REWARDS_ORACLE`. Siga o [Murim CI](../.github/workflows/ci.yml) para reproduzir o conjunto completo. O roteiro abaixo compara respostas HTTP dos dois backends em contas sintéticas e testa o painel com o proxy ativo, após instalar o Chromium de Playwright ou definir `CHROME_BIN`.

```sh
bun install --frozen-lockfile
bun run precommit:nuxt
NITRO_PRESET=node-server bun run build:nuxt
bun run test:nuxt --browser
node scripts/check-fastapi-http.mjs --browser
```

A CI do Android executa `:app:testDebugUnitTest` e `:app:assembleDebug` com uma origem HTTPS de teste. Use a propriedade Gradle `fitnessApiOrigin` para apontar um build de homologação ao gateway Nuxt isolado.

## Homologação, publicação e rollback

1. Valide o SHA exato no PR e use um ambiente isolado com backup/restauração e cópia de schema e dados sintéticos. Execute o ciclo Alembic e confirme saldos, histórico e sessões preexistentes. Teste Strava, login Google, Oráculo e sincronização Health Connect com contas de homologação e aparelho Android. Verifique consumo de conexões, latência, erros de autenticação e integridade do extrato.
2. Para publicação futura autorizada, preserve o domínio, o segredo do Better Auth e o material de criptografia do Strava. Prepare o FastAPI com a mesma versão do schema, uma role restrita e escrita inicialmente desabilitada. Verifique dependências e supervisione a drenagem de requisições antes de trocar a origem no Nuxt e habilitar a escrita. Encaminhe toda a superfície de negócio à mesma implementação durante a transição. Não use retries automáticos entre serviços em mutações.
3. Para reversão, pause novas mutações, aguarde requisições e transações em curso e retire `NUXT_MURIM_FASTAPI_ORIGIN` da configuração do Nuxt. Reative o tráfego pelo Nitro após validar identidade e leituras. O schema e os registros gerados são compartilhados. Conserve os dados gravados e reconcilie treino, recompensas, claims, saldo e extrato com amostras antes de retomar tráfego normal. O downgrade do baseline é independente da troca de roteamento.
4. Caso o ambiente de homologação ainda esteja indisponível, o ponto de retomada são os testes do item 1. A CI substitui os provedores externos por respostas sintéticas. A verificação com credenciais de homologação e Health Connect no aparelho depende de um ambiente HTTPS e das respectivas contas e permissões de teste.
