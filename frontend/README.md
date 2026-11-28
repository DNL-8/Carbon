# Murim — Next.js

Next.js, React, Material UI e TanStack Query. Execute bun install --frozen-lockfile em frontend/ e configure .env.local com MURIM_FASTAPI_ORIGIN. O proxy Next.js encaminha autenticação e API ao FastAPI. O único login é Google.

Comandos: bun run dev --port 38200; bun run generate:api; bun run typecheck; bun run build; bun run test.

Playwright inicia a stack isolada, usando PostgreSQL descartável e provedores Google, Gemini e Strava simulados. Valida desktop, mobile, acessibilidade, sessões, treinos, arsenal e saúde. Não use credenciais reais.


## Lint React

Execute `bun run lint` em `frontend/`. O comando usa Biome 2.2.6 via bunx, sem instalação global; o primeiro uso requer acesso ao registro npm. As regras selecionadas verificam hooks, dependências dos efeitos e chaves de listas JSX. Não aplica formatação automática. A versão do CLI é fixada no comando, mas sua instalação externa não integra o bun.lock da aplicação.

## Arsenal V2

O componente `components/arsenal.tsx` apresenta catálogo de 104 peças, filtros, ordenação, paginação local de 24 itens, conjuntos, compra e resgate. TanStack Query consulta e invalida os dados da API; Zod valida a resposta em `lib/rpg-api.ts`. O cliente usa `acquisition` para distinguir recompensa, compra e item inicial; a autorização é do FastAPI.

A prévia usa o catálogo compartilhado em `../src/utils/equipmentCatalog.ts` e não persiste alterações. `lib/equipment-art.ts` contém 33 famílias SVG e encaixes; `components/equipment-art.tsx`, `avatar-equipment-layer.tsx` e `warrior-avatar.tsx` renderizam miniaturas e mascote. Preservar teclado, foco, contraste, pausa e movimento reduzido.

Testes em `tests/flow.spec.ts` cobrem navegação, comparação, resgate e equipar, restauração de prévia, golpe e pausa. Consulte [design](../DESIGN.md), [regras](../docs/plano-arsenal.md) e [CI](../docs/ci.md).

## Avatar V2 (GLB)

O componente `components/avatar-glb-preview.tsx` carrega os modelos de `public/assets/avatar-v2/` sob demanda, com Three.js 0.186.0, React Three Fiber 9.8.2, GLTFLoader e SkeletonUtils. O Arsenal abre a prévia na engrenagem; `components/murim.tsx` e `components/training.tsx` oferecem a opção compacta. A prévia anterior (`warrior-avatar.tsx`) e seu fallback SVG continuam disponíveis. Modo compacto econômico, qualidade selecionável na prévia completa, sete animações, aparência e encaixes modulares. Não há mudança na API ou no inventário. Não executar `experiments/avatar-v2/prepare.mjs` na main já integrada; é um preparador exclusivo do laboratório. Consulte [guia técnico](../docs/avatar-3d.md) e [homologação](../docs/HOMOLOGACAO-AVATAR-V2.md). Deploy automático configurado como desativado; não publicar sem autorização.
