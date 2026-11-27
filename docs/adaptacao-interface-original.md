# Adaptação da interface original do Murim

Estado da main após os PRs 37–43 (26/11/2026). Os oito HTML são referências visuais externas ao repositório, não código de aplicação. Não importar capturas com informações pessoais. Preserve os componentes React originais em `src/components` e `src/features/navigation`.

| Referência HTML | React original | Vue/Nuxt atual |
| --- | --- | --- |
| login.htm | AuthScreen.tsx | OriginalAuthScreen.vue; Better Auth |
| treina.htm | WorkoutsListView.tsx / WorkoutSessionScreen.tsx | OriginalWorkoutCatalog, OriginalWorkoutCard, OriginalFocusSession, OriginalBossSprite, OriginalExerciseDemo, CustomWorkoutEditor |
| Fitness RPG & Saúde — Monitoramento diário e relatórios.htm | DashboardView.tsx | HeroDashboard, OriginalDualProgress, OriginalWeightTracker |
| painel.htm | ControlPanelView.tsx | HeroDashboard; /api/painel |
| arsenal.htm | ArmoryView.tsx / ShadowKnightSprite.tsx | HeroDashboard, OriginalMascot, ProgressLedger |
| relatorios.htm | ReportsAndHealthView.tsx | HealthImport, HealthActivityChart, OriginalHealthConnections |
| perfil.htm | ProfileView.tsx | OriginalProfileView e histórico |
| api.htm | ApiCommandCenterView.tsx | OriginalApiCenter; allowlist em web/shared/console.ts |
| Navegação comum | AppShell.tsx | OriginalAppShell; abas via query tab |
| Oráculo | OracleCoachView.tsx | OriginalOracleView; /api/oracle/ask |

## Implementação e critérios de aceite

As telas acima foram adaptadas, mas não se declara equivalência pixel a pixel. A interface Vue usa fontes, cores e geometrias SVG do projeto original, com adaptação das animações. Recompensas, compras e recordes são calculados no servidor; não copiar os valores das capturas. Dados ausentes não devem ser inventados.

Diferenças e pendências: visitante preservado no login; configuração Resend/Gemini/Strava e teste Android físico; histórico do Oráculo limitado à sessão; zonas cardíacas somente quando disponíveis; conferência de gráficos avançados e estados, funcionalidades de conta e PWA; retomada offline após recarga ainda requer validação. A central API não executa SQL arbitrário nem concede XP/HP diretamente.

Antes de afirmar paridade, comparar cada tela com a referência original (desktop/mobile, vazios, erros, dados preenchidos, foco e animações), testar navegação, ações autenticadas e acessibilidade. CI verde verifica fluxos, não aparência integral.

O legado permanece para referência visual e testes atuais. O banco antigo não foi migrado automaticamente. Consulte o [checklist](../CHECKLIST-MIGRACAO.md).
