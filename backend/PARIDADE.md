# Matriz de paridade Nitro e FastAPI

Inventário dos 39 handlers em `web/server/api`. As linhas abaixo consolidam métodos da mesma rota.

| Método e rota | Contrato e regra preservados | Evidência |
| --- | --- | --- |
| GET `/api/health`, `/api/ready` | Sondas do processo e da dependência de banco, com endpoints FastAPI próprios | Pytest, Docker, CI Nuxt |
| Todas `/api/auth/**` | Identidade, login, verificação, senha, OAuth Google, sessões e cookies sob Better Auth no Nitro | Integração Better Auth no navegador e testes da ponte Python |
| GET `/api/conta` | Indicador de autenticação verificada | HTTP |
| GET `/api/catalogo` | Catálogo estático e exercícios | HTTP e comparação integral dos exports TS |
| GET `/api/conquistas` | Definições, desbloqueios, datas e bônus | HTTP, exports TS e SQL |
| GET `/api/estado` | Perfil, saldo, HP, arsenal, treinos, votos brutos e missões | HTTP |
| GET `/api/extrato` | Paginação, ordenação, deltas e saldos por conta | HTTP e SQL |
| GET, PUT `/api/heroi` | Perfil, classe, objetivos e campos biométricos opcionais | HTTP e SQL |
| GET, POST `/api/missao` | Metas diárias e semanais, raid, semana ISO, limite temporal de São Paulo e resgate único | HTTP e concorrência PostgreSQL |
| GET, POST `/api/votos` | Limite de 20, resolução diária, XP, limites de HP e extrato | HTTP e concorrência PostgreSQL |
| GET `/api/painel` | Resumo de sete dias, dados de 28 dias, peso, atributos, ACWR e prontidão | HTTP com e sem sessões, importação e fisiologia |
| GET `/api/progresso` | XP, Qi, ranks, níveis, reinos, streak, HP e bônus de equipamento | HTTP, SQL e oráculo TS |
| GET, POST `/api/arsenal` | Catálogo, requisitos, equipagem, compra, saldo e extrato | HTTP, oráculo TS e compra concorrente em SQL |
| GET, POST `/api/arsenal/conjuntos` | Listar, salvar, aplicar e remover presets com validação de slot, dono e limite | HTTP e SQL |
| POST `/api/treinos/concluir` | Combate, PR, snapshot, conquistas, XP e moedas em uma transação; reenvio e conflito | HTTP, oráculo TS, concorrência e rollback SQL |
| GET `/api/treinos/historico` | Últimas 30 sessões, recordes, snapshots e compatibilidade com histórico legado | HTTP e SQL |
| GET `/api/treinos/personalizados` | Templates da conta | HTTP |
| PUT, DELETE `/api/treinos/personalizados/{id}` | Campos e IDs por proprietário, preservação do histórico; reenvio idêntico preserva IDs atribuídos em Python | HTTP e SQL |
| POST `/api/saude/importar` | Apple Health, Samsung Health, GPX e CSV, deduplicação e XP | HTTP e SQL |
| GET, POST `/api/saude/health-connect` | Contrato Kotlin, métricas parciais, mesclagem, deduplicação e XP | HTTP, concorrência SQL e teste do contrato Android |
| GET `/api/saude/resumo` | Janela, filtros, tendências, média cardíaca e zonas | HTTP e SQL |
| PUT, DELETE `/api/saude/peso` | Limites, data São Paulo e unicidade por conta e dia | HTTP, navegador e SQL |
| GET `/api/mobile/config` | ID público OAuth do Google e resposta de indisponibilidade | HTTP e Pytest |
| GET `/api/strava/config`, `/api/strava/status` | Configuração pública e sessão Strava por conta | HTTP e contratos com respostas simuladas |
| GET `/api/strava/callback` | Estado vinculado à sessão, cookies, erro/sucesso e redirect 303 | HTTP, sucesso e erro simulados, interoperabilidade dos cookies |
| POST `/api/strava/auth-url`, `/api/strava/disconnect`, `/api/strava/sync` | Autorização, cookies AES-GCM compatíveis, refresh, paginação e importação atômica | HTTP com provedor simulado e persistência PostgreSQL |
| POST `/api/oracle/ask` | Rate limit por conta, histórico agregado, saúde opt-in, resposta Gemini e falhas | HTTP com Gemini simulado e Pytest de opt-in |

**HTTP** representa comparação das 36 combinações de método e rota de negócio, com status e corpos JSON de sucesso em contas sintéticas equivalentes, com roteamento pelo Nuxt e PostgreSQL 18. Datas auto-geradas são validadas no formato UTC com milissegundos e normalizadas na comparação. IDs de exercícios gerados e IDs sequenciais do extrato são normalizados. O teste também cobre requisição anônima e origem indevida. Nos contratos de erro o status é comparado, e a API Python preserva os campos públicos `statusCode` e `statusMessage`. As respostas de diagnóstico do Nitro variam conforme o modo de execução.

O PostgreSQL serializa operações sobre saldo pelo lock da linha de progresso do proprietário. Cada conclusão, reivindicação ou importação grava o resultado e o extrato na mesma transação. O teste força rollback depois de atualizar XP, moedas, histórico, recordes, conquistas e extrato. O rate limit do Oráculo é local à instância, como no Nitro.

## Verificações de homologação

- Validar Google OAuth, Strava e Gemini com contas e credenciais de teste, incluindo renovação e cookies entre os dois backends. Os contratos automatizados usam respostas sintéticas.
- Validar permissões, leitura e reenvio do Health Connect em aparelho Android usando o gateway HTTPS da homologação.
- Ensaiar a troca de roteamento e a reversão com uma cópia isolada compatível do schema, sessões e dados de teste.
