# Instruções para trabalhar no Murim

- A arquitetura ativa é Nuxt 4/Vue 3 em `web/`, Nitro, Better Auth, Drizzle/PostgreSQL (Neon). Use a documentação atual do repositório.
- Preserve aparência, layout, cores, fontes e animações das referências originais. Não substitua páginas por designs novos. React e HTML originais são referências; não copie dados pessoais das capturas.
- Reutilize utilitários RPG compartilhados em `src/`; não duplique regras de recompensa.
- Valide sessão e propriedade no servidor, não exponha segredos, não execute migrações nem testes contra produção.
- Use `bun install --frozen-lockfile`, `bun run precommit:nuxt`, build e testes de navegador. Preserve migrações e backups.
- Next.js/React ainda é compilado na CI legada. Não remova seus arquivos ou dependências sem mapear referências e validar a retirada.
- A main é destino das alterações aprovadas; não declare paridade visual ou publicação Vercel sem verificação.

## Desenvolvimento de interfaces

<<<<<<< HEAD
=======
This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Desenvolvimento de interfaces

>>>>>>> 7aaa789 (quase pronto)
- Use Taste Skill (`design-taste-frontend`) para definir hierarquia visual, composição, tipografia e estados quando criar ou redesenhar telas.
- Consulte o `DESIGN.md` do projeto quando existir. Use [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md) como catálogo de referências, adaptando princípios à identidade do App-fitness.
- Use UI From Image (`ui-from-image`) quando houver uma referência visual para implementar. Trate capturas de bugs como evidência do problema.
- Revise interfaces web com Web Design Guidelines (`web-design-guidelines`), incluindo semântica, foco, teclado e responsividade.
- Use Playwright CLI (`playwright-cli`) para validar os fluxos web alterados. Confira a renderização em desktop e celular quando o layout mudar.
