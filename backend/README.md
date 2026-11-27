# Murim — FastAPI

Em backend/, execute uv sync --locked (Python 3.13) e configure um .env privado conforme .env.example. FastAPI é responsável pela autenticação, regras de negócio e acesso ao PostgreSQL.

## Banco
Defina MURIM_MIGRATION_DATABASE_URL como conexão direta. Em banco existente com o schema completo, execute uv run alembic upgrade head e uv run alembic check. Em banco novo e vazio, execute MURIM_BOOTSTRAP_EMPTY=1 uv run alembic upgrade head. Nunca use essa flag em bancos existentes. O baseline congelado preserva as 17 tabelas existentes; SQL histórico está arquivado em migrations/archive, não é executado em instalações novas. Novas revisões são Alembic.

## Execução
uv run uvicorn app.main:app --host 127.0.0.1 --port 38202 --no-access-log

Configure APP_ORIGIN com a origem pública exata do frontend. As credenciais e IDs autorizados são privados; consulte [autenticação](../docs/python-auth-cutover.md). ENABLE_WRITES deve ser habilitado somente em ambiente preparado. /api/health verifica processo; /api/ready verifica configuração e banco.

## Testes
uv run ruff check . e uv run pytest -q. Testes de integração exigem PostgreSQL descartável, loopback e banco murim_fastapi_test. Veja [CI](../docs/ci.md). Não use dados de produção.
