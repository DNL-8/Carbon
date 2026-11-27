# Murim CI

Dois jobs em paralelo:
- Aplicação: PostgreSQL descartável inicializado por Alembic, oráculos RPG, Ruff, pytest, auditoria Python via pip-audit sobre o lockfile, Docker FastAPI, auditoria frontend, contratos, TypeScript, build e Playwright desktop/mobile.
- Android: testes unitários Kotlin e compilação APK.

A rotina de backup PostgreSQL criptografado continua independente, condicionada às variáveis já existentes. Não altere a proteção da main. Testes nunca usam produção.


O job de aplicação executa também `bun run lint` (Biome 2.2.6 via bunx) antes do typecheck e build do frontend, com foco em regras React. O arquivo OpenAPI gerado não é lintado.
