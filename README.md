# Murim — Fitness RPG & Saúde

Aplicativo de treinos e saúde com progressão RPG de Caçadores (XP) e Murim (Qi).

**Stack alvo (em homologação):** Next.js / React / Material UI, FastAPI / Python, Authlib / Google OAuth, PostgreSQL / Neon, SQLAlchemy, Alembic e Kotlin / Health Connect. Aplicação privada para duas pessoas. O modo Authlib foi testado sem Nitro com contas simuladas; Google real e Android físico ainda precisam de homologação. Nuxt e Better Auth permanecem temporariamente para reversão. Não há publicação ou alteração de hospedagem nesta migração.

Consulte [a configuração da autenticação](docs/python-auth-cutover.md) e [o CI centralizado](docs/ci.md).

## Funcionalidades

- Login Google, cadastro por e-mail com link de confirmação e recuperação de senha (Resend). No primeiro acesso, salve a ficha do personagem para abrir o painel. A biometria é opcional.
- Início e Painel: progressão dual, XP, missões, votos, raid, agenda, peso e atributos.
- Treinar: catálogo, filtros, trilha inicial, treinos personalizados, Modo Foco, séries, descanso, combate SVG e demonstrações anatômicas.
- Mantenha o Modo Foco aberto se a conexão cair. As séries e o Guia Técnico continuam disponíveis. Reconecte e escolha **Reenviar treino** para salvar a mesma sessão. Recarregar a página perde a sessão pendente.
- Arsenal: avatar equipado, prévia, compras, conjuntos e extrato.
- Perfil: ficha, biometria opcional, atributos, conquistas e recordes.
- Relatórios: atividades, métricas, gráficos, importação Apple Health, Samsung Health, GPX e CSV.
- Strava OAuth e Health Connect Android, dependentes de autorização e configuração real.
- Oráculo Gemini autenticado, com compartilhamento opcional de métricas de saúde.
- Central API com rotas permitidas, validação no servidor e confirmação de alterações.

A adaptação dos componentes originais está na main; a equivalência visual integral e os fluxos de integração com contas reais ainda precisam de validação.

## Organização

```text
frontend/           Next.js, React, Material UI e Playwright
backend/            FastAPI, SQLAlchemy, Authlib, Alembic e pytest
web/app/            Interface Vue legada para reversão
web/server/api/     Rotas Nitro autenticadas e públicas
web/server/utils/   Autenticação, banco, missões, integrações
web/server/db/      Schema Drizzle
web/shared/         Schemas Zod, combate e comandos compartilhados
web/drizzle/        Oito migrações SQL e metadados
web/tests/          Testes Nuxt
src/utils/          Regras RPG, geometria anatômica e parsers reutilizados
src/server/gemini.ts Cliente Gemini compartilhado
src/components/     Componentes React originais (referência)
app/                Aplicação Next.js anterior (verificação manual)
android/            Kotlin, Compose e Health Connect
scripts/            Validação, instalação, build e backup
.github/workflows/  CI e backup criptografado
```

## Desenvolvimento local — stack alvo

Prepare um PostgreSQL isolado e configure o FastAPI conforme [backend/README.md](backend/README.md) e [Authlib](docs/python-auth-cutover.md). Para um banco novo, execute o bootstrap Alembic descrito no backend. Inicie FastAPI em loopback e, em `frontend/`, execute `bun install --frozen-lockfile` e `bun run dev --port 38200` com `MURIM_AUTH_PROVIDER=authlib` e `MURIM_FASTAPI_ORIGIN` apontando ao FastAPI. Não use credenciais reais nos testes automatizados.

## Desenvolvimento local — fallback legado

Requisitos: Node.js 24, Bun 1.4.5 e PostgreSQL de desenvolvimento. Na raiz:

```bash
bun install --frozen-lockfile
```

Copie `.env.example` para `.env` e configure um banco isolado, nunca o banco de produção para testes. Use a conexão pooled em `DATABASE_URL` e a direta em `DATABASE_URL_DIRECT`.

```bash
bun run db:migrate
bun run dev:nuxt --port 3000
```

Abra http://localhost:3000. As migrações são versionadas; gere novas com `bun run db:generate` somente quando o schema mudar e revise o SQL.

### Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão PostgreSQL da aplicação |
| DATABASE_URL_DIRECT | Conexão direta para migração |
| BETTER_AUTH_URL | Origem do aplicativo |
| BETTER_AUTH_SECRET | Segredo aleatório, pelo menos 32 caracteres |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Login Google |
| RESEND_API_KEY / AUTH_EMAIL_FROM | Verificação de e-mail e redefinição de senha |
| GEMINI_API_KEY / GEMINI_MODEL | Oráculo (opcional) |
| STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_SESSION_SECRET | OAuth Strava (opcional, segredo de sessão >= 32 caracteres) |

Nunca versione credenciais. Veja [Neon e backup](docs/neon-postgresql.md) e [integrações](docs/integracoes-nuxt.md). As variáveis legadas no exemplo só atendem ao Next.js anterior.

## Testes e CI

```bash
bun run precommit:nuxt
bun run build:nuxt
bunx playwright-core install chromium
bun run test:nuxt --browser
```

Para iniciar o artefato Node: `bun run start:nuxt`. O teste integrado usa PGlite descartável, socket PostgreSQL e e-mail simulado. Não depende do Neon produtivo.

- `nuxt.yml`: verificação manual do legado, inclusive backup/restore em PostgreSQL 18.
- `ci.yml`: dois checks automáticos: Aplicação (FastAPI + Next.js, incluindo Authlib) e Android.
- `legacy-app.yml`: verificação manual do frontend anterior.
- `nuxt-backup.yml`: backup criptografado age, semanal ou manual, retenção de 30 dias.

Depois do deploy, execute manualmente **Verificar revisão publicada do Murim** no GitHub Actions com o SHA completo que deve estar no ar.

## Deploy

O projeto Vercel usa Bun com lockfile congelado e o comando de build de `vercel.json`. Configure as variáveis Production no projeto correto, valide o build e publique a revisão desejada. Registre no Google a origem `https://murim-iota.vercel.app` e o callback `https://murim-iota.vercel.app/api/auth/callback/google`.

- `GET /api/health` retorna `status: "ok"` e, quando a Vercel fornece `VERCEL_GIT_COMMIT_SHA`, a revisão publicada.
- `GET /api/ready` → `{"ready":true}`: configuração de auth e acesso ao schema; HTTP 503 quando indisponível.
- Compare o commit no painel Vercel com a main. Teste login, treino e persistência no ambiente correto.

Docker: `docker build -f Dockerfile.nuxt -t app-fitness .`; execute com variáveis de runtime adequadas. Para staging de artefato Vercel no Windows, mantenha `scripts/stage-nuxt-vercel.mjs` e use o preset Vercel.

## Documentação

- [Checklist de migração e pendências](CHECKLIST-MIGRACAO.md)
- [Adaptação da interface original](docs/adaptacao-interface-original.md)
- [Neon, migrações e backup](docs/neon-postgresql.md)
- [Integrações externas](docs/integracoes-nuxt.md)
- [Android](android/README.md)
- [Segurança e endpoints](SECURITY_ANALYSIS.md)
- [Invariantes e testes de segurança](security_spec.md)
