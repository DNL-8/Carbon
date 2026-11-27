# Murim em Next.js

O frontend cobre login, ficha de personagem, catálogo, edição de treinos, Modo Foco, recompensa, painel, histórico, extrato, missões, raids, votos, conquistas, arsenal, peso, relatórios de saúde, importações, Health Connect, Strava e Oráculo. Usa Next.js App Router, React, TypeScript, MUI/Emotion, TanStack Query, React Hook Form, Zod e `openapi-typescript`.

## Execução em ambiente isolado

Na raiz, instale as dependências com `bun install --frozen-lockfile` e compile o Nuxt com `NITRO_PRESET=node-server bun run build:nuxt`. Prepare o FastAPI com `uv sync --locked` em `backend/`. Aplique as migrações Drizzle em um PostgreSQL descartável chamado `murim_fastapi_test`.

Em `frontend/`:

```sh
bun install --frozen-lockfile
bun run generate:api
bun run typecheck
bun run build
bunx playwright install chromium
MURIM_TEST_DATABASE_URL=<url-do-postgres-local> bun run test
```

O Playwright sobe Next.js, Nitro/Better Auth e FastAPI em loopback, atrás de um gateway exclusivo dos testes. Usa contas sintéticas, intercepta o envio do e-mail de verificação e simula Strava e Gemini. A suíte verifica a jornada em desktop e celular, auditoria axe no login, no treino e no arsenal e reenvio depois de o servidor salvar a primeira solicitação. Também cobre criação, edição e exclusão de um treino sem apagar o histórico, resgate de missões, penalidades, compra e equipagem no arsenal, registro de peso, as quatro importações de saúde, visualização do Health Connect, OAuth Strava simulado e consentimento por consulta no Oráculo. É possível usar o Chromium já instalado com `CHROME_BIN`.

Para uso manual, execute `bun run dev --port 38200`. Configure `MURIM_FASTAPI_ORIGIN` para o serviço Python e `MURIM_AUTH_ORIGIN` para o Nitro, em variáveis privadas do Next.js. Os serviços usam a mesma origem pública em `BETTER_AUTH_URL`; o FastAPI usa também `AUTH_ORIGIN` apontando ao Nitro. O proxy preserva cookies, `Origin` e redirects. O runtime do backend continua calculando as recompensas.

A geração obtém o OpenAPI diretamente de `app.openapi()`, sem consultar banco. O cliente usa os tipos gerados para rotas e requisições. Respostas que o FastAPI ainda publica com schema genérico têm validação Zod no frontend.

## Referência visual

A interface Nuxt é a fonte para paleta, tipografia, mascote, cartões, navegação fixa e Modo Foco. A migração preserva o padrão escuro e o destaque laranja, com Plus Jakarta Sans para texto e JetBrains Mono para métricas. A revisão combina capturas nos mesmos tamanhos de tela, navegação por teclado, foco visível, estados de erro e testes automatizados.

A homologação externa cobre OAuth com contas de teste, respostas reais do Gemini, Health Connect em aparelho Android e a revisão visual das telas restantes. O Nuxt segue como referência e opção de reversão.

## Troca de frontend e reversão

O ensaio local alterna Next.js e Nuxt no mesmo endereço, em desktop e celular. Ele verifica que a conta e o identificador de sessão permanecem iguais, que estado, saldo e histórico permanecem consistentes, que repetir uma conclusão pela outra interface conserva uma única recompensa e que sair da conta revoga o acesso em ambas. Um envio sintético no formato Android testa a sincronização durante a troca.

Execute o cenário com `bun run test -g 'troca e reverte'` após preparar o ambiente isolado. Use `MURIM_CAPTURE_CUTOVER=1` para guardar a comparação dos recibos em `test-results/`. O seletor de frontend usado pelo gateway pertence à suíte Playwright.

Em homologação, mantenha o domínio e os cookies do Better Auth e encaminhe a navegação ao Next.js. O Next.js encaminha as rotas de identidade ao Nitro e as rotas de negócio ao FastAPI. Mantenha `/_next/` no Next.js e `/_nuxt/` no Nuxt durante a janela de reversão para atender abas ainda abertas. Verifique treino, extrato, OAuth e sincronização a partir de sessões já abertas antes de trocar o tráfego.

Para reverter, deixe as mutações em andamento terminarem e encaminhe a navegação novamente ao Nuxt pelo gateway. Preserve a origem das APIs, o banco e as sessões. Verifique que uma conclusão gravada pelo Next.js aparece no histórico do Nuxt antes de retomar o tráfego normal.
