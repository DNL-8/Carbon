# Murim CI

Dois jobs em paralelo:
- Aplicação: PostgreSQL descartável inicializado por Alembic, oráculos RPG, Ruff, pytest, Docker FastAPI, auditoria frontend, contratos, TypeScript, build e Playwright desktop/mobile.
- Android: testes unitários Kotlin e compilação APK.

A rotina de backup PostgreSQL criptografado continua independente, condicionada às variáveis já existentes. Não altere a proteção da main. Testes nunca usam produção.
