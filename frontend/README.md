# Murim — Next.js

Next.js, React, Material UI e TanStack Query. Execute bun install --frozen-lockfile em frontend/ e configure .env.local com MURIM_FASTAPI_ORIGIN. O proxy Next.js encaminha autenticação e API ao FastAPI. O único login é Google.

Comandos: bun run dev --port 38200; bun run generate:api; bun run typecheck; bun run build; bun run test.

Playwright inicia a stack isolada, usando PostgreSQL descartável e provedores Google, Gemini e Strava simulados. Valida desktop, mobile, acessibilidade, sessões, treinos, arsenal e saúde. Não use credenciais reais.


## Lint React

Execute `bun run lint` em `frontend/`. O comando usa Biome 2.2.6 via bunx, sem instalação global; o primeiro uso requer acesso ao registro npm. As regras selecionadas verificam hooks, dependências dos efeitos e chaves de listas JSX. Não aplica formatação automática. A versão do CLI é fixada no comando, mas sua instalação externa não integra o bun.lock da aplicação.
