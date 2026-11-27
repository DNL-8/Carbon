# Homologação do Carbon — Murim

Use uma instalação de homologação separada, com duas identidades Google autorizadas para teste e PostgreSQL isolado. Não use dados reais de saúde em testes automatizados, logs, screenshots ou artefatos públicos. Nunca copie cookies, IDs de contas, tokens ou secrets para este documento. A aprovação de CI não substitui a homologação com provedores reais.

## 1. Identificar a versão e o ambiente

- [ ] Confirmar SHA exato em `main`, status dos dois jobs em [GitHub Actions](https://github.com/DNL-8/Carbon/actions) e correspondência do deployment com o SHA.
- [ ] Confirmar que a origem web de homologação executa Next.js em `frontend/` e o upstream executa FastAPI em `backend/`, não um deployment legado Nuxt/Nitro.
- [ ] Confirmar separação entre banco de teste e produção; conferir o [schema Neon](neon-postgresql.md) e restaurar um backup de teste em ambiente isolado antes de qualquer migração real.
- [ ] Confirmar `APP_ORIGIN`, `MURIM_FASTAPI_ORIGIN` e as variáveis necessárias do backend, apenas pela presença e configuração no ambiente autorizado; não divulgar valores.
- [ ] Habilitar escritas somente no ambiente de homologação preparado. Não alterar infraestrutura, nem executar deploy ou migrations em produção como parte deste roteiro.

## 2. Verificações automáticas

Na raiz do checkout em Windows PowerShell, verifique alterações locais com `git status --short` e a versão com `git rev-parse HEAD`. Use o pipeline [CI](ci.md) como referência; os comandos abaixo complementam o pipeline.

| Diretório | Comandos |
| --- | --- |
| backend/ | `uv sync --locked`, `uv run ruff check .`, `uv run pytest -q` |
| frontend/ | `bun install --frozen-lockfile`, `bun run typecheck`, `bun run build`, `bun run test` |
| android/ | `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` |

A CI provisiona um PostgreSQL descartável e provedores simulados. Se executados localmente, os testes de integração exigem o banco descartável `murim_fastapi_test` em loopback. Não apontar para produção. Em mudanças da API, regenerar tipos no frontend e verificar o diff do arquivo gerado.

## 3. Verificação de disponibilidade (somente leitura)

Com as origens de homologação já confirmadas, verificar `/api/health` no FastAPI (processo) e `/api/ready` (banco e autenticação configurados). Não interpretar health como readiness. Na origem web, confirmar login acessível, HTTPS e ausência de sessão sem autenticação. Não imprimir cookies, headers completos ou respostas com dados pessoais.

## 4. Google OAuth e isolamento

Seguir [python-auth-cutover.md](python-auth-cutover.md).

- [ ] Login web da conta A e da conta B, logout, recarga e nova sessão.
- [ ] Terceira identidade de teste recusada; origem de escrita diferente recusada.
- [ ] Criar registro sintético distinto em cada conta, confirmar que A nunca lê/altera B e vice-versa.
- [ ] Validar Android com package e SHA-1 do APK de teste e o cliente Google adequado. Sessão inválida deve exigir novo login.
- [ ] Validar expiração e revogação; não reutilizar tokens nem compartilhar cookies.

## 5. Saúde, Gemini e Strava

- [ ] Desktop e mobile: treino, progressão XP/Qi, missões, arsenal, registro e remoção de pesagem, importação sintética repetida, gráficos, estados vazios, foco, teclado e ausência de overflow.
- [ ] Gemini: consentimento, pergunta sintética, resposta válida, erro controlado e ausência de chaves no cliente. Não enviar dados clínicos reais.
- [ ] Strava: OAuth de teste, callback, importação, deduplicação e desconexão; não sincronizar a conta real como teste automatizado.
- [ ] Android físico: instalar APK de homologação, autorizar Health Connect e a permissão nova de calorias ativas; conferir passos, sono, frequência cardíaca e calorias com dados de teste.
- [ ] Reimportar uma atividade corrigida, conferir dados atualizados e XP inalterado. Testar permissões parciais, revogação, interrupção de rede, expiração do checkpoint e troca de conta. Testar WorkManager em segundo plano; o intervalo de seis horas não garante execução exata.
- [ ] Verificar limitações conhecidas: alterações fora da janela de 30 dias e exclusões individuais ainda não são reconciliadas automaticamente; calorias históricas antigas podem corresponder à energia total. Nenhum dado histórico deve ser apagado durante a homologação.

## 6. Critério de aceite

Registrar data, SHA, ambiente (sem segredos), plataforma, resultado e pendências de cada cenário. Anexar apenas evidências sintéticas e sem dados pessoais. Não declarar produção homologada enquanto houver cenários reais não verificados, divergência de versão, falha de build, migração incompatível ou erro de isolamento.

Referências: [DESIGN.md](../DESIGN.md), [Android](../android/README.md), [backend](../backend/README.md), [frontend](../frontend/README.md).
