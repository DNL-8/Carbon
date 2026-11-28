<div align="center">

<img src="frontend/public/assets/mascote-murim.svg" width="160" alt="Mascote do Murim: robô guerreiro de armadura grafite com espada de treino e esfera de Qi">

# Murim — Fitness RPG & Saúde

**Treine no mundo real, evolua seu personagem no jogo.**

[![Murim CI](https://github.com/DNL-8/Carbon/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DNL-8/Carbon/actions/workflows/ci.yml)

[Acessar aplicativo](https://carbon-web-nine.vercel.app) · [Funcionalidades](#funcionalidades) · [Arquitetura](#arquitetura) · [Como rodar](#como-rodar-localmente) · [Testes](#testes-e-qualidade) · [Status](#status-do-projeto) · [Documentação](#documentação)

</div>

---

Aplicação web e Android de treinos, saúde e progressão de personagem, inspirada no universo Murim. As atividades físicas alimentam duas trilhas de evolução, a de **Caçador (XP)** e a de **cultivo (Qi)**, com batalhas, missões e acompanhamento de recuperação.

O projeto é de uso privado, feito para duas pessoas, com foco em simplicidade, desempenho, segurança, baixo custo e manutenção. O cadastro é fechado por padrão; GOOGLE_OPEN_SIGNUP=true permite cadastro automático com Google verificado, sem lista manual. Não há login por senha nem modo visitante.

## Funcionalidades

| Módulo | O que faz |
| --- | --- |
| 🏋️ **Treinos** | Catálogo e treinos personalizados, séries, cargas, repetições, cronômetro de descanso e histórico. |
| ⚔️ **Progressão RPG** | XP, Qi, níveis, atributos, batalhas contra chefes, missões, votos e conquistas. |
| 🛡️ **Arsenal** | 104 equipamentos em dez conjuntos, com bônus, prévia interativa no avatar 3D e extrato de compras. |
| ❤️ **Saúde** | Atividades, passos, sono, frequência cardíaca, calorias, peso, IMC e indicadores de carga e recuperação. |
| 📈 **Relatórios** | Gráficos de evolução do peso e tendência de atividades, filtros por período e fonte e valores em texto. |
| 📥 **Importação** | Arquivos do Apple Health e Samsung Health, GPX e CSV, além de integração OAuth com o Strava. |
| 📱 **Android** | App Kotlin que sincroniza dados autorizados do Health Connect. |
| 🔮 **Oráculo** | Assistente com Gemini para consultas sobre treino e recuperação. |

O Oráculo envia ao Gemini a pergunta, dados de progressão e perfil de jogo e um resumo dos treinos. O resumo de recuperação e carga só é incluído quando autorizado na consulta.

> [!IMPORTANT]
> As métricas de recuperação e as respostas do Oráculo são informativas. Não constituem diagnóstico nem recomendação médica individual.

<details>
<summary><strong>Regras do Arsenal</strong></summary>

<br>

- **Peças:** quatro slots (Cabeça, Vestimenta, Manto e Arma), com 26 peças cada. São 51 de Caçador, 51 de Murim e duas iniciais.
- **Aquisição:** 15 recompensas de marco, resgatadas sem custo (inclusive por progresso anterior), e 87 compras com moedas. Adquirir e equipar são ações separadas.
- **Bônus:** especializados em XP, moedas ou dano contra chefes. Os conjuntos dão +4% com 2 peças ou +10% com 4 peças (não acumulam).
- **Catálogo:** busca que ignora acentos, filtros, ordenação, 24 peças por página e comparação com o equipamento ativo.
- **Avatar:** o Avatar V2 é uma prévia 3D opcional de modelos GLB articulados (Murim e Caçador), renderizada por Three.js e React Three Fiber. Mantém as 33 famílias e as 104 variantes de equipamentos, sete animações, personalização, câmera, pausa e movimento reduzido. O avatar procedural WebGL anterior e seu fallback SVG permanecem disponíveis.
- **Identidade visual:** vestes e adornos marciais, equipamentos táticos de Caçador e efeitos de Qi/Mana. Visores, armas duplas, ombreiras e capas possuem encaixes específicos. Há validação automatizada e amostragem aproximada de colisões; revisão visual completa e desempenho físico permanecem pendentes.

A coleção completa é opcional e não exige uma rotina específica de treino. Detalhes em [Arsenal V2](docs/plano-arsenal.md).

</details>

## Arquitetura

```mermaid
flowchart TD
    U["Usuários"] --> W["Frontend web<br/>Next.js + React"]
    U --> A["App Android<br/>Kotlin"]
    HC["Health Connect<br/>Dados de saúde"] --> A
    W --> P["Proxy da API · Next.js"]
    A --> P
    P --> F["Backend · FastAPI / Python<br/>Treinos, saúde e RPG"]
    F --> D[("Banco de dados<br/>PostgreSQL / Neon")]
    F <--> G["Google OAuth · Login"]
    F <--> S["Strava · Atividades"]
    F <--> I["Gemini · Assistente IA"]

    classDef client fill:#1e3a5f,stroke:#60a5fa,color:#ffffff
    classDef gateway fill:#422006,stroke:#fb923c,color:#fff7ed
    classDef server fill:#164e3b,stroke:#34d399,color:#ffffff
    classDef storage fill:#312e81,stroke:#a5b4fc,color:#ffffff
    class W,A client
    class P gateway
    class F server
    class D storage
```

A web e o Android falam com a API pelo proxy do Next.js. O FastAPI concentra autenticação, autorização, regras de negócio e persistência. O diagrama descreve a arquitetura do código, não um ambiente de produção homologado.

### Stack

| Camada | Tecnologias |
| --- | --- |
| Web | Next.js (App Router), React, TypeScript |
| Interface | Material UI, Emotion, MUI X Charts Community |
| Avatar 3D | Three.js 0.186.0, React Three Fiber 9.8.2, GLB/glTF 2.0, Blender no laboratório; WebGL procedural e SVG como alternativas |
| Estado e formulários | TanStack Query, React Hook Form, Zod |
| API | Python, FastAPI, Pydantic, Uvicorn |
| Autenticação | Google OAuth2/OIDC com Authlib e sessões próprias |
| Banco de dados | PostgreSQL / Neon, SQLAlchemy, psycopg, Alembic |
| Android | Kotlin, Jetpack Compose, Material 3, Health Connect, WorkManager |
| Qualidade | Biome, Ruff, pytest, Playwright, axe-core, JUnit, GitHub Actions |
| Dependências | Bun e uv, com lockfiles versionados |

### Estrutura do repositório

```text
Carbon/
├── frontend/           # Next.js, componentes, gráficos e testes Playwright
├── backend/            # FastAPI, regras de negócio, Alembic e testes
├── android/            # App Kotlin, Health Connect e Gradle wrapper
├── src/                # Tipos e regras RPG de referência em TypeScript
├── scripts/            # Verificações de paridade e backup
├── docs/               # Documentação técnica e homologação
├── .github/workflows/  # CI e backup do PostgreSQL
├── AGENTS.md           # Instruções para agentes de desenvolvimento
└── DESIGN.md           # Identidade visual e acessibilidade
```

## Avatar V2

- No Arsenal, abra a engrenagem e escolha **Abrir laboratório GLB**. A prévia não compra, equipa nem altera bônus por si só.
- Em Início/Painel e durante o treino, use **Exibir Avatar V2** para a visualização compacta sob demanda.
- Escolha Murim, Caçador ou Automático, personalize a aparência e permita equipamentos dos dois mundos. A aparência é cosmética; propriedade e bônus continuam validados pelo FastAPI.
- Modelos atuais: Murim 733.532 bytes; Caçador 741.412 bytes; total 1.474.944 bytes (aprox. 1,47 MB). O orçamento de laboratório é de até 1,5 MB e 18.000 triângulos por GLB.
- Sete clips: repouso, ataque, vitória, descanso, defesa, esquiva e canalização de Qi/Mana. Consulte [guia técnico](docs/avatar-3d.md) e [homologação do Avatar V2](docs/HOMOLOGACAO-AVATAR-V2.md).

## Hospedagem

A arquitetura utiliza Vercel (Next.js e FastAPI) e PostgreSQL Neon. [Aplicativo web](https://carbon-web-nine.vercel.app).

**Publicações pausadas por solicitação do proprietário:** os arquivos `vercel.json` na raiz, em `frontend/` e em `backend/` desabilitam deploys automáticos de `main`, `feature/avatar-v2-glb` e `feature/avatar-v2-final-publish`. A configuração está versionada; sua aplicação pela Vercel deve ser confirmada antes de afirmar que o bloqueio está efetivo. Não solicitar deploy manual, remover o bloqueio ou criar release sem autorização. A versão disponível no endereço público pode ser anterior à main.

## Como rodar localmente

### Pré-requisitos

| Para | Instale |
| --- | --- |
| Web | Node.js 24 e Bun 1.4.5 |
| API | Python 3.13 e uv |
| Banco | PostgreSQL 16 ou superior (a CI usa o 18), em uma instância só para desenvolvimento |
| Login | Cliente OAuth no Google Cloud |
| Android (opcional) | JDK 17 e Android SDK 35 |

Os comandos usam **Windows PowerShell**. Comece na raiz do repositório; as etapas 2 a 4 continuam no diretório `backend/`.

> [!CAUTION]
> Nunca aponte o ambiente local, os testes ou o bootstrap para o banco de produção.

### 1. Configurar o backend

```powershell
cd backend
uv sync --locked
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Preencha o `backend/.env`:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL da API. |
| `APP_ORIGIN` | Origem exata do frontend. Localmente, `http://127.0.0.1:38200` (a configuração HTTP de login não aceita `localhost`; fora do loopback, use HTTPS). |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | Cliente OAuth do Google. |
| `PYTHON_AUTH_SECRET` | Segredo aleatório com pelo menos 32 caracteres. |
| `GOOGLE_USERS` | JSON que liga o `sub` de cada conta Google a um ID interno distinto. |
| `ENABLE_WRITES` | Vem como `false`. Use `true` em um ambiente preparado para registrar dados e usar o Oráculo. |
| `GEMINI_API_KEY` e `GEMINI_MODEL` | Opcionais, para o Oráculo. |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` e `STRAVA_SESSION_SECRET` | Opcionais, para o Strava. Exigem `APP_ORIGIN` em HTTPS e segredo de sessão com 32 caracteres ou mais. |

No Google Cloud, cadastre a URI de callback `http://127.0.0.1:38200/api/auth/callback/google`. Veja [autenticação Google](docs/python-auth-cutover.md).

### 2. Preparar o banco

O Alembic lê as variáveis do terminal (não do `.env`) e exige uma conexão direta, sem pooler. Crie previamente um banco de desenvolvimento **novo e vazio**:

```powershell
$env:MURIM_MIGRATION_DATABASE_URL = 'postgresql://USUARIO:SENHA@127.0.0.1:5432/murim_dev'
$env:MURIM_BOOTSTRAP_EMPTY = '1'
uv run alembic upgrade head
Remove-Item Env:MURIM_BOOTSTRAP_EMPTY
uv run alembic check
Remove-Item Env:MURIM_MIGRATION_DATABASE_URL
```

Substitua os valores de exemplo pela conexão privada de desenvolvimento e confirme o sucesso de cada comando. Em um banco **existente** com o schema compatível, não defina `MURIM_BOOTSTRAP_EMPTY`. Para o schema antigo, siga a [migração legada](docs/migracao-legado.md).

### 3. Provisionar o usuário (modo fechado)

No modo aberto, configure GOOGLE_OPEN_SIGNUP=true; o primeiro login cria a conta.

O login não cria contas. Em um banco de desenvolvimento novo, após confirmar a identidade e o e-mail verificado de cada conta Google, insira o usuário com o mesmo e-mail:

```sql
INSERT INTO auth_user (id, name, email, email_verified)
VALUES ('jogador-dev', 'Jogador Dev', 'voce@example.com', true);
```

Depois, associe o `sub` verificado dessa conta ao ID no `.env`:

```dotenv
GOOGLE_USERS={"SEU_GOOGLE_SUB":"jogador-dev"}
```

Use IDs distintos para as duas contas autorizadas. Nunca vincule automaticamente uma conta apenas pelo e-mail nem versione as identidades reais.

### 4. Iniciar a API

```powershell
uv run uvicorn app.main:app --host 127.0.0.1 --port 38202 --no-access-log
```

| Endereço | Para quê |
| --- | --- |
| http://127.0.0.1:38202/docs | Swagger |
| http://127.0.0.1:38202/api/health | Verifica se o processo está no ar |
| http://127.0.0.1:38202/api/ready | Verifica autenticação e banco |

### 5. Iniciar o frontend

Em outro terminal, na raiz do repositório:

```powershell
cd frontend
bun install --frozen-lockfile
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
bun run dev --port 38200
```

O `.env.local` precisa de `MURIM_FASTAPI_ORIGIN=http://127.0.0.1:38202`. Acesse http://127.0.0.1:38200.

### 6. Compilar o Android (opcional)

Em outro terminal, na raiz do repositório:

```powershell
cd android
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug "-PfitnessApiOrigin=https://seu-app.example"
```

- O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.
- Informe sempre a origem HTTPS do seu ambiente, igual ao `APP_ORIGIN`, por `-PfitnessApiOrigin` ou pela variável `FITNESS_API_ORIGIN`. Sem isso, o build usa `https://carbon-web-nine.vercel.app`; o APK de CI continua usando a origem fictícia.
- No Google Cloud, registre o pacote `com.dnl8.fitnessrpg.debug` (versão debug) e o SHA-1 da assinatura.
- Requer Android 8.0 (API 26) ou superior. A disponibilidade do Health Connect depende também do sistema e das permissões do dispositivo.

No Linux ou macOS, use `./gradlew`. Instalação e permissões estão no [guia Android](android/README.md).

## Testes e qualidade

| Diretório | Comandos |
| --- | --- |
| `backend/` | `uv run ruff check .` · `uv run pytest -q` |
| `frontend/` | `bun run lint` · `bun run typecheck` · `bun run build` · `bun run test` |
| `android/` | `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` |

- **Integração:** exige um PostgreSQL descartável em loopback, com banco `murim_fastapi_test` já inicializado, informado em `MURIM_TEST_DATABASE_URL`. Sem a variável, o pytest pula esses testes de integração.
- **Playwright:** além do banco acima em `127.0.0.1`, requer `uv sync --locked` no backend, `bun run build`, o Chromium (`bunx playwright install chromium`) e as portas 38200 e 38212 livres. Os provedores Google, Gemini e Strava são simulados.
- **Contrato da API:** ao mudar o OpenAPI, execute `bun run generate:api` em `frontend/`.

A CI principal tem dois jobs, **Aplicação** (FastAPI + Next.js) e **Android**, que cobrem paridade das regras RPG, lint, testes, auditoria de dependências, migrations, backup e restauração em banco descartável, builds, testes web em desktop e mobile e testes de interface no emulador. Veja [CI](docs/ci.md). O laboratório Avatar V2 possui CI separada com variantes rígida, deformável e Blender, além de integração autenticada; não executa deploy.

## Health Connect

A sincronização manual consulta os últimos 30 dias. Com conexão e permissão de leitura em segundo plano, o WorkManager também sincroniza periodicamente, a cada seis horas aproximadamente.

- Coleta somente calorias ativas, sem o metabolismo basal.
- Medições ausentes não aparecem como zero nos relatórios.
- Importações são deduplicadas, e atividades corrigidas mantêm o XP original.
- Tokens de alterações são criptografados por conta e permissões; o checkpoint só avança após a confirmação dos lotes.

**Limitações atuais:** alterações provocam a releitura da janela de 30 dias; exclusões individuais e correções fora dessa janela não são reconciliadas automaticamente; calorias importadas por versões antigas podem representar a energia total.

## Segurança e privacidade

- Acesso restrito a identidades Google vinculadas a contas internas distintas.
- O servidor valida a sessão, a origem das escritas e a propriedade dos registros.
- Sessões web usam cookies `HttpOnly` e `SameSite` (`Secure` em HTTPS), expiram em sete dias e têm apenas o hash do token guardado no servidor.
- O Android mantém o cookie em armazenamento criptografado.
- Nunca versione segredos, tokens, IDs de contas autorizadas ou dados pessoais de saúde.
- O backup criptografado do PostgreSQL tem workflow próprio; sua configuração e a restauração real precisam ser verificadas.

## Status do projeto

O resultado atual da integração contínua está no selo no topo e em [Actions](https://github.com/DNL-8/Carbon/actions). Em 28/11/2026, a revisão do Avatar V2 `c36846f` foi aprovada em quatro jobs na [CI 46173361553](https://github.com/DNL-8/Carbon/actions/runs/46173361553) e integrada em `e55aec8` após a [transferência 46174356809](https://github.com/DNL-8/Carbon/actions/runs/46174356809). A [CI da integração na main](https://github.com/DNL-8/Carbon/actions/runs/46174423506) deve ser consultada pelo SHA exato. CI aprovada não equivale a homologação com serviços reais.

Ainda falta confirmar:

- [ ] Login Google, Gemini e Strava com provedores reais
- [ ] Health Connect em aparelho físico
- [ ] Restauração de um backup real em ambiente isolado
- [ ] Compatibilidade do banco de destino (há um [schema legado](docs/neon-postgresql.md) documentado)
- [ ] Correspondência entre o deployment de produção e esta versão
- [ ] Validação visual manual do Arsenal, dos encaixes 3D e do fallback SVG em desktop e mobile

Antes de usar dados reais, siga o [roteiro de homologação](docs/homologacao.md).

## Documentação

| Tema | Documentos |
| --- | --- |
| Aplicações | [Frontend](frontend/README.md) · [Backend](backend/README.md) · [Android](android/README.md) |
| Configuração e dados | [Autenticação Google](docs/python-auth-cutover.md) · [PostgreSQL / Neon](docs/neon-postgresql.md) · [Migração legada](docs/migracao-legado.md) |
| Qualidade | [CI](docs/ci.md) · [Homologação](docs/homologacao.md) · [Auditoria](docs/auditoria.md) |
| Produto e design | [Arsenal V2](docs/plano-arsenal.md) · [Avatar 3D](docs/avatar-3d.md) · [Checklist Avatar V2](docs/CHECKLIST-AVATAR-V2.md) · [Homologação Avatar V2](docs/HOMOLOGACAO-AVATAR-V2.md) · [Roteiro visual](docs/roteiro-visual-murim.md) · [Design system](DESIGN.md) |
| Contribuição com agentes | [AGENTS.md](AGENTS.md) |
