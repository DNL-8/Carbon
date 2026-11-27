# Murim — Design System

Referência visual do Carbon. Documenta a implementação atual de `frontend/app/globals.css`, `frontend/components/providers.tsx`, `frontend/app/layout.tsx` e `android/app/src/main/java/com/dnl8/fitnessrpg/FitnessScreen.kt`. Preserve a identidade existente; não representa uma autorização de redesign.

## Direção visual

- Fitness RPG privado: foco em treino, saúde, progressão e recuperação; atmosfera de cultivo sem excesso ornamental.
- Tema escuro, contraste funcional, hierarquia clara, superfícies discretas e conteúdo legível. Mascote existente no login; não substituir por imagens genéricas.
- Ações primárias em laranja no web; verde para sucesso e progresso positivo. Não confundir recompensa de jogo com benefício clínico nem usar cor como único indicador.
- Componentes do Material UI com Emotion; Android usa Jetpack Compose e Material 3. Não introduzir outra biblioteca de estilos.

## Tokens web

| Papel | Valor |
| --- | --- |
| Fundo | `#09090b` |
| Superfície interna | `#111113` |
| Superfície | `#18181b` |
| Divisor/borda decorativa | `#27272a` |
| Texto principal | `#fafafa` |
| Texto secundário | `#a1a1aa` |
| Ação e destaque | `#fb923c` |
| Sucesso | `#34d399` |
| Foco visível | `#fdba74` |
| Texto sobre ação laranja | `#09090b` |

Os tokens web são centralizados em `frontend/lib/theme-tokens.ts` e expostos ao CSS por `GlobalStyles` no tema MUI. Os valores acima são existentes, não uma certificação de contraste de todas as combinações. Bordas decorativas não substituem contraste de controles; valide estados interativos e erros pelo tema MUI.

## Tipografia, composição e componentes

- Texto: Plus Jakarta Sans Variable, com fallback system-ui; métricas e cronômetros: JetBrains Mono Variable, números tabulares. Fontes locais via Fontsource.
- Título de tela: 24–30 px; seção: cerca de 17 px; corpo: 14 px; rótulos: 12 px. Preserve escalonamento responsivo e espaçamento entre linhas.
- Usar a escala de espaçamento existente (4, 8, 12, 16, 20, 24 px) e superfícies consistentes. Raios: tema MUI 6 px, cards 8 px; login 28 px e cronômetro circular são exceções atuais.
- Shippori Mincho, Chakra Petch e bordas retas são referências de direção futura, não fontes ou raios implementados. Não trocá-los sem aprovação.
- Reutilize Button, TextField, Tabs, Dialog, Alert, LinearProgress e as classes surface, inset, metric, view e overview. Botões MUI têm alvo de 44 px por padrão; filtros têm mínimo de 44 px e exceções compactas devem ser verificadas.
- Mantenha ações de exclusão separadas e confirmação explícita; preserve estados de carregamento, erro, vazio e sucesso e feedback acessível.

## Layout responsivo

- Mobile primeiro: navegação inferior fixa com quatro colunas em duas linhas abaixo de 640 px, oito colunas em tablets, rótulos de 12 px e alvos de 48 px, safe areas e conteúdo sem transbordamento horizontal; cards de treino e métricas se adaptam ao espaço.
- A partir de 640 px: ampliar espaçamentos; a partir de 1024 px: sidebar de 288 px, login em duas colunas. Conteúdo principal até 1280 px; sessão de treino até 672 px.
- Tabelas podem rolar dentro de região nomeada com foco. Não criar rolagem horizontal na página.
- Validar pelo menos 360/390 px e desktop 1280 px, textos longos e zoom. Não depender de hover no mobile.

## Saúde e gráficos

- Unidade explícita: kg, km, min, kcal, bpm, h; números no formato pt-BR e datas sem deslocamento por fuso.
- Valor ausente: travessão ou “Sem medição”, não zero inventado. Não ligar lacunas como medições reais. Diferenciar calorias ativas e estimadas; totais parciais devem ser identificados.
- Evolução do peso: linha temporal com pontos observados; evitar suavização que invente valores. Tendência de atividade: barras por dia e métrica selecionada; preservar filtros. Zonas cardíacas: rótulos e duração, não apenas cores.
- MUI X Charts Community é utilizado nas visualizações de peso e tendência de atividade. Preserve o lockfile e reutilize essa biblioteca para novos gráficos. Usar cores do tema, altura responsiva, animação desativada ou respeitando movimento reduzido. Manter alternativa textual/tabela com valores exatos, incluindo lacunas. Não exigir tooltip ou mouse para acessar dados.
- Sono, frequência cardíaca, carga e recuperação são métricas informativas, não diagnóstico nem autorização automática para treino intenso.

## Android

O tema atual é escuro verde: fundo `#101410`, superfície `#192019`, variante `#232D22`, ação `#B8F575`, texto `#F1F5EA`, texto secundário `#C0CCBA` e erro `#FFB4AB`. O hero tem raio 28 dp. Preserve essa identidade nativa e contraste, não replique automaticamente o tema laranja web. Estados de login, permissões parciais, sincronização, erro e logout devem ser claros.

### Resumo Health Connect

Referência visual autorizada: organização em cartões de saúde, valores destacados, mini gráficos e navegação simples das telas de Saúde fornecidas pelo usuário. Adaptação nativa no tema verde escuro Murim, com laranja para atividade, lavanda para sono e rosa para frequência cardíaca. Abas Resumo e Conexão; preservar login, permissões e sincronização. O resumo local é atualizado por ação explícita, exibe sete dias, mantém lacunas e não grava dados localmente. Não incluir pontuação de sono, ciclo menstrual, humor ou recuperação cardíaca pós-treino sem dados e contratos específicos. Gráficos têm descrições de acessibilidade por dia.

## Checklist para mudanças visuais

- [ ] Usar tokens e componentes existentes, sem redefinir o tema global.
- [ ] Verificar contraste WCAG AA, navegação por teclado, foco, rótulos e leitores de tela.
- [ ] Verificar desktop/mobile, áreas de toque, movimento reduzido e estados assíncronos.
- [ ] Conferir unidades, datas, dados ausentes e significado das cores.
- [ ] Executar typecheck, build e Playwright/axe conforme o escopo; conferir capturas e informar limitações.

Referência operacional: [AGENTS.md](AGENTS.md), [CI](docs/ci.md) e [frontend](frontend/README.md). Skills de design devem ser usadas se disponíveis, sem alegar execução não verificada.
