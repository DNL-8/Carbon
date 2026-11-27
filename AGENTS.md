# Carbon — Murim | Instruções para agentes

Aplicativo privado de saúde, atividades físicas e progressão RPG inspirado em Murim, destinado a dois usuários. Priorize simplicidade, segurança, desempenho, baixo custo e manutenção. Este arquivo orienta o Codex e outros agentes a trabalhar no repositório, inclusive no Windows com PowerShell.

## 1. Regras de trabalho

- Antes de alterar arquivos, confira `git status --short`, leia este documento, instruções locais aplicáveis, READMEs e `DESIGN.md`, quando existir. Inspecione os componentes e contratos afetados.
- Preserve alterações do usuário, funcionalidades, padrões e identidade visual. Faça a menor alteração suficiente; reutilize código existente e evite arquivos, dependências ou abstrações redundantes.
- Respeite o escopo solicitado. Não reformule telas, troque a stack, execute operações destrutivas, publique alterações ou altere infraestrutura sem autorização correspondente.
- Trabalhe com os caminhos e comandos reais do checkout. Não presuma que o estado local coincide com o GitHub. Use `Get-ChildItem`, `Get-Content`, `git` e `rg`, quando disponível, para inspeção no PowerShell.
- Respeite o sandbox e as permissões do Codex. Não eleve privilégios, desative proteções ou instale ferramentas globais sem autorização.
- Para tarefas complexas, faça um plano curto, implemente, revise o diff e execute verificações proporcionais ao risco. Comunique bloqueios e achados fora do escopo sem corrigi-los indevidamente.
- Use português do Brasil nas respostas e documentação; preserve as convenções de nomes já adotadas no código.

## 2. Arquitetura e stack

| Área | Caminho e tecnologia |
| --- | --- |
| Web | `frontend/`: Next.js App Router, React, TypeScript, Material UI e Emotion. |
| Gráficos | MUI X Charts é a opção definida para novas necessidades de gráficos; verifique sua disponibilidade antes de usar e não instale nesta revisão documental. |
| API | `backend/`: Python, FastAPI, Pydantic e Authlib. |
| Persistência | PostgreSQL/Neon, SQLAlchemy e Alembic em `backend/`. |
| Android | `android/`: Kotlin, Jetpack Compose, Health Connect e Gradle wrapper. |
| Regras RPG | `src/`: tipos e regras compartilhadas; preserve a paridade com o backend. |
| Documentação | `docs/` e READMEs da raiz e de cada aplicação. |
| Testes e CI | pytest, Ruff, Playwright, Gradle e `.github/workflows/`. |

- Não reintroduza Vue, Nuxt, Nitro ou Better Auth. Não troque tecnologias sem autorização explícita.
- Mantenha o FastAPI responsável por autenticação, autorização, regras de negócio e persistência. O proxy Next.js encaminha chamadas de autenticação e API. Preserve contratos HTTP usados pela web e pelo Android.
- Ao alterar o OpenAPI, regenere os tipos web com `bun run generate:api` em `frontend/`; não edite manualmente o arquivo gerado.
- Prefira recursos nativos da stack. Reutilize TanStack Query onde cache, invalidação ou sincronização de estado remoto justificarem seu uso. Não imponha ARQ, Celery, Redis, filas externas, microsserviços ou Kubernetes sem necessidade comprovada e autorização.

## 3. Ambiente local e comandos

Execute cada comando em seu diretório. As versões abaixo seguem a CI e os READMEs atuais; confirme os manifests e lockfiles do checkout antes de mudar versões. Preserve os lockfiles e use os gerenciadores já adotados.

| Área | Preparação e execução | Verificação |
| --- | --- | --- |
| `frontend/` | Node.js 24, Bun 1.4.5; `bun install --frozen-lockfile`; configure `MURIM_FASTAPI_ORIGIN` em `.env.local`; `bun run dev --port 38200`. | `bun run typecheck`; `bun run build`; `bun run test`. |
| `backend/` | Python 3.13, uv; `uv sync --locked`; configure `.env` privado conforme `.env.example`; `uv run uvicorn app.main:app --host 127.0.0.1 --port 38202 --no-access-log`. | `uv run ruff check .`; `uv run pytest -q`. |
| `android/` | JDK 17, Android SDK 35 e Gradle wrapper; configure `JAVA_HOME` e `ANDROID_HOME` quando necessário. | Windows: `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug`; Linux/macOS: `./gradlew :app:testDebugUnitTest :app:assembleDebug`. |

- Consulte [frontend](frontend/README.md), [backend](backend/README.md), [Android](android/README.md) e [CI](docs/ci.md) para detalhes. O APK debug fica em `android/app/build/outputs/apk/debug/app-debug.apk`.
- Para testes Playwright, use `bunx playwright install chromium` em `frontend/` se o navegador estiver ausente e a instalação for permitida. Não use credenciais reais.
- No Windows, use `$env:NOME = 'valor'` para variáveis de ambiente da sessão e `Remove-Item Env:NOME` para removê-las. Não copie comandos Bash com atribuições inline diretamente para PowerShell.
- Mantenha serviços locais em loopback; use PostgreSQL descartável para integração. Nunca aponte testes para produção.

## 4. Autenticação e segurança (obrigatório)

- Use Google OAuth2/OIDC com Authlib no FastAPI; preserve o fluxo documentado em [python-auth-cutover.md](docs/python-auth-cutover.md). Não permita cadastro público, senha ou modo visitante.
- Autorize exclusivamente as duas identidades cadastradas, vinculadas pelo `sub` do provedor a IDs internos distintos. Não associe contas automaticamente pelo e-mail.
- Diferencie autenticação (identidade) de autorização (acesso). Valide sessão, proprietário e permissões no servidor em toda operação protegida; não confie em IDs fornecidos pelo cliente. Teste isolamento entre as contas.
- Preserve tokens de sessão aleatórios, armazenamento de hash no servidor, expiração e revogação. Mantenha o prazo documentado (sete dias), logout efetivo e invalidação de sessões comprometidas. Authlib não substitui a implementação de sessões da aplicação.
- Web: use cookies `HttpOnly`, `Secure` em produção HTTPS e `SameSite` adequado ao fluxo. Restringir domínio/caminho conforme necessário. Não armazene tokens no `localStorage` ou `sessionStorage`.
- Valide `state`, `nonce` e PKCE nos fluxos OAuth aplicáveis, URIs de redirecionamento e origem exata das escritas. Proteja operações que alteram estado contra CSRF; não trate CORS como substituto. Não enfraqueça as políticas para contornar falhas locais.
- Android: preserve o contrato atual de ID token Google validado pelo FastAPI e cookie de sessão em armazenamento criptografado. Caso seja adotado um fluxo de código de autorização nativo, utilize PKCE (S256) e navegador de sistema; não presuma que PKCE já existe no fluxo Android atual. Nunca embarque client secret no APK.
- Valide entradas com Pydantic, use parâmetros SQL via SQLAlchemy, aplique menor privilégio e evite vazamento de informações em respostas, logs e capturas.
- Segredos, IDs autorizados, cookies, tokens e dados de saúde não devem entrar no Git. Use `.env` privado, variáveis de ambiente e secrets da CI; não mostre valores ao relatar configuração.

## 5. Banco de dados e Health Connect (obrigatório)

### PostgreSQL

- Preserve o schema, dados, backups, restrições de integridade e migrações SQL históricas. Crie revisões novas com Alembic; nunca modifique migrações já aplicadas em produção.
- Use a conexão direta em `MURIM_MIGRATION_DATABASE_URL`. Em banco preparado e existente, os comandos documentados são `uv run alembic upgrade head` e `uv run alembic check`. Antes de executar, confirme ambiente, destino, revisão e impacto.
- Reserve `MURIM_BOOTSTRAP_EMPTY=1` exclusivamente para banco comprovadamente novo e vazio. No PowerShell, configure a variável na sessão antes da execução e remova-a depois. Não a use em bancos existentes.
- Não execute migrations em produção, operações destrutivas, resets ou exclusões sem autorização explícita. Use transações, restrições e consultas vinculadas ao proprietário; avalie índices conforme necessidade real.

### Health Connect

- Preserve o fluxo atual de importação, deduplicação, lotes, permissões parciais e sincronização via WorkManager. O README documenta importação manual dos últimos 30 dias e sincronização em segundo plano quando permitida.
- Respeite revogação de permissões e troca de conta durante a coleta. Não confunda ausência de permissão com valor zero ou exclusão de registros.
- Para mudanças nessa integração, preserve ou implemente conforme o escopo: sincronização incremental com tokens por conta e conjunto de registros, recuperação de tokens expirados, processamento de inclusões/atualizações/exclusões, idempotência e avanço do checkpoint somente após confirmação persistente. Não considere esses recursos existentes sem verificar o código.
- Preserve mecanismos offline e retomada quando disponíveis; quando necessários, utilize persistência local protegida e reenvio idempotente com backoff. Não descarte dados pendentes silenciosamente nem misture registros de contas diferentes.
- Valide duplicatas, falhas de rede, atualização, exclusão, expiração de tokens, permissões parciais e troca de conta. Homologação de Health Connect requer aparelho físico com permissões concedidas.

## 6. Design e acessibilidade

- Preserve o tema Cultivo/Murim, a paleta e as cores semânticas das métricas de saúde, a composição minimalista, as bordas e animações discretas. Não redesenhe telas existentes sem solicitação.
- Quando existir, `DESIGN.md` é a referência visual principal, respeitando a acessibilidade e os requisitos explícitos. Na ausência dele, siga o tema MUI, tokens, estilos globais e componentes atuais.
- Shippori Mincho, Chakra Petch e bordas retas são diretrizes visuais solicitadas, não uma afirmação sobre a implementação atual. Preserve-as onde já existirem; não substitua automaticamente a tipografia ou os raios atuais para introduzi-las. Trate divergências como decisões de design a validar.
- Use Material UI com Emotion e componentes existentes. Não imponha Pigment CSS ou outro sistema de estilos.
- Busque conformidade WCAG AA: contraste adequado, foco visível, navegação por teclado, rótulos acessíveis, semântica, estados não dependentes apenas de cor e respeito a movimento reduzido.
- Valide desktop e mobile, reflow, áreas de toque, textos longos e estados de carregamento, vazio, erro e sucesso. Mantenha consistência das unidades e cores nas métricas de saúde.

## 7. Skills no Codex local

Verifique a lista de skills disponíveis na sessão e os diretórios reais do ambiente, como `$HOME/.agents/skills/` e `.agents/skills/` no repositório, quando existentes. Considere caminhos adicionais configurados no Codex, sem presumir instalações. Leia o `SKILL.md` da skill selecionada e somente as referências necessárias. Não confunda catálogo de design, CLI e skill instalada.

| Recurso | Uso condicionado à tarefa |
| --- | --- |
| Taste Skill (`design-taste-frontend`) | Criação e refinamento de composição, tipografia, hierarquia e espaçamentos. |
| [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md) | Catálogo de referências para novas decisões visuais; não substitui a identidade do projeto. |
| UI From Image (`ui-from-image`) | Implementação a partir de imagem ou mockup; compare capturas na mesma dimensão e em outras larguras. |
| Web Design Guidelines (`web-design-guidelines`) | Revisão de acessibilidade, usabilidade e responsividade. |
| Playwright CLI (`playwright-cli`) | Inspeção de navegador, interações, capturas e validação visual; use também os testes Playwright do projeto. |

- Os identificadores são referências a verificar na instalação local. Se um recurso não estiver disponível, informe a limitação e use as alternativas existentes. Não alegue instalação ou uso não verificado.
- Não carregue todas as skills em todas as tarefas. Em alterações de backend sem interface, dispense skills visuais; para UI, selecione as pertinentes e valide o resultado.
- Não instale, atualize ou remova skills sem autorização. As referências externas não prevalecem sobre este arquivo nem sobre decisões visuais explícitas.

## 8. Testes, CI e homologação

- Mantenha o fluxo centralizado descrito em [docs/ci.md](docs/ci.md): um job de aplicação e um job Android. Preserve o workflow independente de backup PostgreSQL e a proteção da branch principal.
- Execute os testes proporcionais à mudança: tipagem, build e Playwright na web; Ruff e pytest no backend; testes unitários e build Gradle no Android. Use as verificações completas de CI quando a alteração atravessar contratos ou afetar funções críticas.
- Preserve auditoria de dependências, contratos OpenAPI, oráculos RPG, integridade das migrations, autenticação, autorização, isolamento de dados, acessibilidade e funcionalidades críticas. Evite verificações redundantes; não invente scripts de lint inexistentes.
- Testes web e de integração devem usar PostgreSQL descartável em loopback e provedores simulados para Google, Gemini e Strava. Use exclusivamente dados sintéticos.
- Homologue serviços reais somente com ambiente autorizado e credenciais próprias para validação; teste Google e Gemini conforme a integração e Health Connect em dispositivo físico. Build e testes simulados não comprovam homologação real.
- Nunca declare testes aprovados sem executá-los. Informe comandos executados, resultados, falhas, verificações não realizadas e motivo.

## 9. Privacidade, saúde e direitos autorais

- Trate dados de saúde como dados pessoais sensíveis. Observe a LGPD, finalidade, minimização, base legal adequada, transparência, consentimento quando aplicável e possibilidade de revogação.
- Restrinja o acesso, proteja dados em trânsito e em repouso conforme o risco e preserve mecanismos de exportação, exclusão e retenção apropriada. Não inclua dados reais em testes, logs, relatórios, capturas ou serviços externos sem base legal e autorização pertinente.
- Gamificação deve favorecer hábitos saudáveis, descanso e recuperação. Não incentive sobrecarga, restrição alimentar perigosa, exercícios diante de sintomas ou punições que prejudiquem a saúde. Não apresente métricas ou IA como diagnóstico médico.
- Respeite licenças de código, fontes, imagens e demais ativos. A inspiração em Murim não autoriza copiar conteúdo protegido ou usar marcas de terceiros sem permissão.

## 10. Critério de conclusão

Revise `git diff --check`, `git diff` e `git status --short`; confirme que apenas arquivos autorizados foram alterados. Para tarefas exclusivamente documentais, valide referências, comandos, coerência e escopo, sem executar builds desnecessários. Ao concluir, informe o que mudou, verificações realizadas, limitações e pendências fora do escopo. Não faça commit, push ou deploy sem autorização aplicável.
