# Checklist de migração — Murim

Atualizado em 26/11/2026, a partir da adaptação incorporada no commit `acb6a6e`.

## Implementado e incorporado

- [x] Nuxt 4, Vue 3, Nitro, Pinia, Nuxt UI, Better Auth, Drizzle e PostgreSQL.
- [x] Oito migrações versionadas, perfil, catálogo, histórico, recordes e isolamento por conta.
- [x] Login original, navegação desktop/mobile, catálogo e filtros — PRs [37](https://github.com/DNL-8/App-fitness/pull/37) e [38](https://github.com/DNL-8/App-fitness/pull/38).
- [x] Arsenal com avatar e Perfil com ficha e progressão dual — [PR 39](https://github.com/DNL-8/App-fitness/pull/39).
- [x] Relatórios e endpoint Gemini — [PR 40](https://github.com/DNL-8/App-fitness/pull/40).
- [x] Início, Painel, peso, agenda, raid e atributos — [PR 41](https://github.com/DNL-8/App-fitness/pull/41).
- [x] Modo Foco, séries, descanso, sprites, anatomia e central API — [PR 42](https://github.com/DNL-8/App-fitness/pull/42).
- [x] Strava OAuth e integração Health Connect Android com Neon — [PR 43](https://github.com/DNL-8/App-fitness/pull/43).
- [x] Testes de Nuxt, Node/Vercel, navegador, Docker, Android e backup/restore aprovados nos PRs; não equivalem a validação com serviços reais.
- [x] Workflow de backup age com retenção de 30 dias; restauração do banco antigo testada separadamente.

## Pendências, em ordem de prioridade

| Prioridade | Tarefa | Aceite |
| --- | --- | --- |
| P0 | Publicar a revisão Nuxt atual | Vercel aponta para o commit esperado; health/ready, Google, treino e persistência funcionam |
| P0 | Verificar destino do backup | A conexão do workflow corresponde ao banco ativo; restaurar em banco isolado |
| P0 | Executar a verificação após publicação | Rodar o workflow manual com o SHA do deploy e conferir saúde, prontidão e revisão |
| P1 | Configurar Resend | Cadastro, verificação e recuperação com e-mail real |
| P1 | Configurar Gemini | Resposta real; compartilhamento de saúde opcional e limites conferidos |
| P1 | Configurar Strava | OAuth real, importação e reimportação sem duplicidade |
| P1 | Validar Android | OAuth com SHA-1 de assinatura, APK em aparelho físico, isolamento e sincronização |
| P1 | Validar fidelidade das páginas | Comparar HTML original e Vue em desktop/mobile, animações, navegação e estados |
| P1 | Migração de dados antigos | Plano e ensaio em branch de banco isolada; seis contas antigas não migradas automaticamente |
| P2 | Segurança e confiabilidade | Limites distribuídos, cobertura adversarial, revisão de cookies e importações |
| P2 | Continuidade offline | Persistência segura da sessão pendente, reenvio idempotente e feedback |
| P2 | Paridade de funcionalidades | Rever gráficos avançados, recursos de conta, PWA e diferenças descritas no inventário |
| P3 | Retirada definitiva do legado | Desacoplar utilitários compartilhados, mover CI e scripts, revisar imports e lockfile; preservar referências originais |

Os componentes React, regras Firestore, dependências e testes legados não devem ser removidos em bloco: ainda existem referências de compilação e CI. Nenhuma exclusão de dados antigos está autorizada por esta limpeza de arquivos.

[Inventário de telas](docs/adaptacao-interface-original.md) · [Banco e backup](docs/neon-postgresql.md) · [Integrações](docs/integracoes-nuxt.md)
