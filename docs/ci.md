# Murim CI

Dois jobs em paralelo:
- Aplicação: PostgreSQL descartável inicializado por Alembic, oráculos RPG, Ruff, pytest, auditoria Python via pip-audit sobre o lockfile, Docker FastAPI, auditoria frontend, contratos, TypeScript, build e Playwright desktop/mobile.
- Android: testes unitários Kotlin e compilação APK.

A rotina de backup PostgreSQL criptografado continua independente, condicionada às variáveis já existentes. Não altere a proteção da main. Testes nunca usam produção.


O job de aplicação executa também `bun run lint` (Biome 2.2.6 via bunx) antes do typecheck e build do frontend, com foco em regras React. O arquivo OpenAPI gerado não é lintado.

O job Android mantém testes unitários e build debug, além de testes Compose instrumentados em emulador API 35 e artefatos de capturas sintéticas e APK de CI (origem fictícia). Não há acesso a credenciais ou ao banco real.

## Verificações do Arsenal

A partir da raiz, com Node.js 24:

```sh
node scripts/check-fastapi-equipment.mjs
node scripts/check-equipment-art.mjs
node scripts/check-arsenal-economy.mjs
```

O primeiro script valida catálogo, 104 IDs, 26 peças por slot, modalidades, conjuntos e emite o oráculo TypeScript; a CI redireciona o JSON para `MURIM_EQUIPMENT_ORACLE` e o pytest confronta o resultado com FastAPI. Os demais verificam cobertura das 33 famílias/encaixes e cenários econômicos. A suíte PostgreSQL inclui compras e resgates repetidos/concorrentes; Playwright cobre paginação, prévia, resgate, equipar e mascote.

A CI dispara em pushes para main e feature/arsenal-104, PRs para main e execução manual. Consulte o SHA exato em [Actions](https://github.com/DNL-8/Carbon/actions). Em 28/11/2026, a versão Arsenal V2 `cbee77b` estava na main: [execução 46104328684](https://github.com/DNL-8/Carbon/actions/runs/46104328684), homologação automatizada ainda não concluída na consulta. Não declarar uma execução aprovada antes de confirmar os dois jobs.
