# Murim — Next.js

Next.js, React, Material UI e TanStack Query. Execute bun install --frozen-lockfile em frontend/ e configure .env.local com MURIM_FASTAPI_ORIGIN. O proxy Next.js encaminha autenticação e API ao FastAPI. O único login é Google.

Comandos: bun run dev --port 38200; bun run generate:api; bun run typecheck; bun run build; bun run test.

Playwright inicia a stack isolada, usando PostgreSQL descartável e provedores Google, Gemini e Strava simulados. Valida desktop, mobile, acessibilidade, sessões, treinos, arsenal e saúde. Não use credenciais reais.
