# Murim

## Estrutura e contratos

- `frontend/` contém a aplicação web em Next.js, React e MUI. O proxy do Next.js encaminha as chamadas de autenticação e API ao FastAPI.
- `backend/` contém a API FastAPI, a autenticação com Authlib e o acesso ao PostgreSQL com SQLAlchemy. Sessões e propriedade dos dados são verificadas no servidor.
- `android/` contém o aplicativo Kotlin e Jetpack Compose, que sincroniza dados autorizados do Health Connect com a API.
- Preserve os contratos HTTP usados pela web e pelo Android. Ao alterar o OpenAPI, use `bun run generate:api` em `frontend/` para atualizar os tipos do cliente web. Reutilize as regras RPG compartilhadas em `src/`.

## Ambiente local e verificações

| Diretório | Preparação e execução | Verificações |
| --- | --- | --- |
| `frontend/` | Use Node 24 e Bun 1.4.5. Execute `bun install --frozen-lockfile`. Configure `MURIM_FASTAPI_ORIGIN` em `.env.local` e execute `bun run dev --port 38200`. | `bun run typecheck`, `bun run build` e `bun run test`. |
| `backend/` | Use Python 3.13. Execute `uv sync --locked`, configure o ambiente conforme o README e inicie com `uv run uvicorn app.main:app --host 127.0.0.1 --port 38202 --no-access-log`. | `uv run ruff check .` e `uv run pytest -q`. |
| `android/` | Use JDK 17, Android SDK 35 e o Gradle wrapper do projeto. | No Windows, execute `./gradlew.bat :app:testDebugUnitTest :app:assembleDebug`. No Linux ou macOS, use `./gradlew` com as mesmas tarefas. |

- Use PostgreSQL descartável em loopback para os testes de integração e do Playwright. A suíte web usa provedores simulados para Google, Gemini e Strava e cobre desktop e mobile. Consulte [CI](docs/ci.md) para o fluxo completo.
- A preparação local está nos READMEs do [frontend](frontend/README.md), do [backend](backend/README.md) e do [Android](android/README.md).

## Dados, migrações e homologação

- Use dados sintéticos nos testes e nas capturas. Mantenha credenciais privadas e nunca execute testes contra produção.
- Preserve os dados, as migrações SQL históricas e os backups. Crie novas migrações com Alembic e use a conexão direta em `MURIM_MIGRATION_DATABASE_URL`. Reserve `MURIM_BOOTSTRAP_EMPTY=1` para bancos novos e vazios. Consulte o [guia do backend](backend/README.md) antes de migrar.
- Declare a homologação de serviços reais somente após testes com as credenciais correspondentes e, para o Android, em aparelho físico. Siga o [roteiro de homologação](android/README.md#homologar-em-aparelho-físico).

## Fluxo de trabalho para interfaces

- Em telas existentes, preserve a identidade visual. Use a interface atual, o tema MUI, os tokens e os componentes do projeto como referência. Limite mudanças visuais ao escopo pedido.
- Use Taste Skill (`design-taste-frontend`) para criar telas e refinar composição, tipografia e espaçamento, seguindo a linguagem visual do projeto.
- Consulte o [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md) como catálogo de referência para decisões de design em telas novas. Se o projeto tiver um `DESIGN.md` próprio, siga suas diretrizes.
- Use UI From Image (`ui-from-image`) quando houver uma captura ou mockup de referência. Compare capturas na mesma dimensão da referência e valide a adaptação a outras larguras.
- Use Web Design Guidelines (`web-design-guidelines`) para revisar acessibilidade e responsividade, incluindo contraste, foco visível, navegação por teclado, nomes acessíveis e comportamento em telas estreitas.
- Use Playwright CLI (`playwright-cli`) para inspecionar as telas alteradas em desktop e mobile, comparar capturas e validar interações. Use a suíte Playwright do repositório para testes automatizados dos fluxos afetados.
