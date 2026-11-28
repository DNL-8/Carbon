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

A CI principal dispara em pushes para main e feature/arsenal-104, PRs para main e execução manual. Consulte o SHA exato em [Actions](https://github.com/DNL-8/Carbon/actions). A revisão GLB integrada em `e55aec8` tem [CI principal 46174423506](https://github.com/DNL-8/Carbon/actions/runs/46174423506). Não declarar aprovação antes de confirmar os dois jobs. CI não implica deploy nem homologação real.

## Evidências visuais de homologação

O fluxo Playwright registra capturas das telas principais usando somente fixtures sintéticas, e `tests/arsenal-visual.spec.ts` verifica a prévia e o encaixe das 104 peças, uma captura por família visual e a preservação de posse/equipamento. As imagens ficam no artefato `murim-web-homologacao` por sete dias; a inspeção humana das imagens continua necessária. Não execute a coleta com credenciais reais nem publique dados de saúde.

## Laboratório Avatar V2

O workflow `.github/workflows/avatar-v2-lab.yml` testa a branch `feature/avatar-v2-glb` quando o frontend, `src/` ou o workflow muda, e aceita execução manual. Matriz rigid/skinned/blender: orçamento GLB, sockets, rig, materiais, lint, typecheck, build e Playwright desktop/mobile; em seguida, integração autenticada do Arsenal. `.github/workflows/avatar-v2-blender.yml` verifica a exportação pelo Blender. Artefatos incluem capturas, relatórios de trajetórias e pacote de integração. Último candidato integrado: `c36846f`, [46173361553](https://github.com/DNL-8/Carbon/actions/runs/46173361553), 4/4 jobs aprovados; transferência [46174356809](https://github.com/DNL-8/Carbon/actions/runs/46174356809) conferiu hashes. Não executar `prepare.mjs` na main. Testes usam dados sintéticos. FPS do Chromium com SwiftShader não mede o hardware móvel real. Não realizar deploy; os arquivos Vercel versionados desabilitam deploy automático das branches main, laboratório e transferência, com efetividade a confirmar.
