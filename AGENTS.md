# Murim
- Stack: Next.js / React / MUI (frontend), FastAPI / Authlib / SQLAlchemy / Alembic (backend), PostgreSQL e Kotlin / Health Connect (Android).
- Preserve a identidade visual e os contratos HTTP/Android. Reutilize regras RPG compartilhadas em src/.
- Sessões e propriedade de dados são verificadas no servidor. Não exponha credenciais nem teste contra produção.
- Use Python 3.13 com uv sync --locked, Ruff e pytest no backend. Use Bun 1.4.5 e Node 24 em frontend/, com typecheck, build e Playwright.
- Preserve dados, migrações SQL históricas e backups. Novas migrações são Alembic.
- Não declare homologação de serviços reais sem testes com credenciais e aparelho físico.
