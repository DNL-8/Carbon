# Murim — Fitness RPG & Saúde

Aplicativo privado de treinos e saúde para duas pessoas, com progressão de Caçadores (XP) e Murim (Qi), batalhas, arsenal, missões, importação de saúde e Oráculo Gemini.

## Stack

- Next.js, React e Material UI (frontend).
- FastAPI, Authlib e Pydantic (backend Python).
- PostgreSQL / Neon, SQLAlchemy e Alembic.
- Android Kotlin e Health Connect.
- Playwright, pytest e GitHub Actions.

## Desenvolvimento

Use Node 24, Bun 1.4.5, Python 3.13, uv e PostgreSQL isolado. Backend e frontend são executados separadamente.

1. Prepare o banco com Alembic: [backend](backend/README.md).
2. Configure as duas identidades Google: [autenticação](docs/python-auth-cutover.md).
3. Inicie o FastAPI em loopback e o [Next.js](frontend/README.md).
4. Para Android, configure a origem HTTPS em fitnessApiOrigin.

O [CI](docs/ci.md) executa os checks Aplicação e Android. Os testes de integração usam PostgreSQL descartável e simulam Google, Gemini e Strava. A homologação com os provedores reais e com Health Connect em aparelho físico requer configuração privada.

Antes de conectar um banco existente, confira o [guia de compatibilidade PostgreSQL e Neon](docs/neon-postgresql.md). Guarde credenciais e o mapeamento das contas fora do Git.
