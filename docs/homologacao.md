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
- [ ] No modo fechado, terceira identidade de teste recusada; no modo aberto, nova identidade Google verificada recebe conta independente, e conflito de e-mail sem vínculo é recusado. Origem de escrita diferente recusada.
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

## 6. Arsenal V2

- [ ] Confirmar 104 peças (26 por slot), dez conjuntos, 51 itens de cada trilha e dois iniciais; comparar inventário e conjuntos existentes, sem remover IDs antigos.
- [ ] Conferir resgate de marcos já atingidos (15 no total), sem duplicação, cobrança ou equipamento automático; testar requisito não atingido e saldo insuficiente em compra.
- [ ] Testar requisições simultâneas e repetidas em banco descartável; confirmar isolamento, débito único de compras e preservação do equipamento atual.
- [ ] Conferir os bônus de 2 e 4 peças, filtros por trilha/slot/raridade/conjunto/posse, ordenação, paginação, busca sem acentos e comparação de prévia.
- [ ] Inspecionar as miniaturas e os encaixes das 33 famílias no mascote, incluindo armas longas, asas, auréolas e combinações dos quatro slots; testar golpe, pausa, teclado, foco, movimento reduzido e larguras de 360/390/1280 px.
- [ ] Rodar os scripts de [CI](ci.md) e revisar a [simulação econômica](plano-arsenal.md); não transformar o ritmo simulado em obrigação física.

Registro de referência: `cbee77b` publicado na main; [execução 46104328684](https://github.com/DNL-8/Carbon/actions/runs/46104328684), homologação automatizada ainda não concluída na consulta em 28/11/2026. Homologação manual não confirmada.

## 7. Critério de aceite

Registrar data, SHA, ambiente (sem segredos), plataforma, resultado e pendências de cada cenário. Anexar apenas evidências sintéticas e sem dados pessoais. Não declarar produção homologada enquanto houver cenários reais não verificados, divergência de versão, falha de build, migração incompatível ou erro de isolamento.

Referências: [DESIGN.md](../DESIGN.md), [Android](../android/README.md), [backend](../backend/README.md), [frontend](../frontend/README.md).

## 8. Registro de homologação — 28/11/2026

Versão funcional verificada: [f18d18c](https://github.com/DNL-8/Carbon/commit/f18d18cf6b75c85e65f807c15c32f13d2bf04f58). A [CI 46105794816](https://github.com/DNL-8/Carbon/actions/runs/46105794816) aprovou os dois jobs: 170 testes Python (2 warnings), 10 testes Playwright, build Next.js, auditorias de dependências, Ruff, testes e APK Android, interface Compose no emulador API 35 e restauração criptografada em banco descartável.

| Área | Resultado e limite |
| --- | --- |
| Web e Arsenal | CI aprovada; capturas e inspeção manual ainda pendentes. A nova suíte de evidências testa todas as 104 prévias e registra uma captura por família em cada projeto desktop/mobile, além das telas principais. |
| Android | APK de CI e relatórios disponíveis nos artefatos da execução; APK aponta para origem fictícia, não homologado em aparelho físico. |
| Neon | Consulta somente leitura identificou banco carbon com 17 tabelas esperadas e revisão Alembic `0001_drizzle_baseline`; neondb legado permanece separado. Restrições completas, dados e conexão do deployment não foram validados. |
| Deploy | Projeto Vercel murim encontrado usa configuração Nuxt e deploys de App-fitness; não foi identificado um projeto Carbon nessa conta. Não substituir produção ou apontar o app ao banco legado. |
| OAuth / Strava / Gemini | Fluxos sintéticos aprovados; falta teste real autorizado em ambiente Carbon. |
| Backup | Restore descartável aprovado na CI; configuração e restauração de backup real não comprovadas. |

Não houve acesso a registros pessoais, alteração de infraestrutura, migração de produção nem publicação de aplicativo. A homologação real depende de um ambiente Carbon separado, com origem HTTPS, upstream FastAPI, banco de destino validado e credenciais configuradas privadamente. Não promover ambiente antigo como Carbon.

## 9. Atualização da homologação — 28/11/2026

A revisão `e1951af` foi publicada em ambos os projetos Vercel e aprovada pela [CI 46139706672](https://github.com/DNL-8/Carbon/actions/runs/46139706672). As verificações anteriores de produção, realizadas após a remoção de Cloud Run, confirmaram /api/health e /api/ready com HTTP 200. Cadastro Google e persistência inicial do perfil/progressão foram verificados por contagens no Neon; não foram consultados dados pessoais para esta evidência. O cadastro livre é opt-in via GOOGLE_OPEN_SIGNUP, sem associação automática por e-mail. ENABLE_WRITES foi habilitado em produção. Ainda não há evidência de treino concluído real, recuperação após novo login, duas contas reais isoladas, Gemini/Strava reais, APK em aparelho físico ou restore de backup real. Os testes automatizados continuam isolados. O APK de CI permanece fictício; o padrão do build local foi corrigido para a origem Carbon.
