# Acompanhamento da auditoria

A arquitetura Next.js/FastAPI permanece inalterada. Correções de auditoria são verificadas em PostgreSQL descartável, sem acesso a dados reais.

## Frontend

- Catálogos de treinos e equipamentos extraídos de rpgLogic.ts, mantendo exports e os oráculos de paridade.
- Removidos módulos sem referências de tipos antigos, wrappers RPG, erros Firebase e paginação documentId. Fila offline antiga, alertas de descanso e animações são preservados para avaliação de funcionalidades e dados locais existentes.
- Reenvio de treinos finalizados usa armazenamento local versionado por conta. Não guarda tokens; o navegador não fornece criptografia própria para esse conteúdo. Em dispositivo compartilhado, descarte cópias pendentes explicitamente. Rascunhos novos ainda não finalizados podem ser retomados após recarregar: séries, exercício atual e tempo decorrido são salvos por conta; retomada pausada não conta o intervalo fora da tela. Um rascunho por conta e navegador; não editar o mesmo treino em múltiplas abas. A fila antiga não é migrada automaticamente.
- Importação CSV, GPX e Samsung não inventa duração ou calorias; GPX sem horários válidos é recusado. Apple Health interpreta unidades de duração e não inventa zonas cardíacas; CSV e Samsung sem amostras também não inventam zonas. O contrato numérico ainda usa zero para algumas ausências. IDs históricos derivados de duração podem diferir para registros anteriormente estimados ou com unidade incorreta; revisar duplicatas antes de reimportar esses arquivos. Limites de arquivos reduzem o risco de bloqueio do navegador. Contrato legado ainda não distingue todos os zeros e ausências de todas as fontes; transformação completa exige revisão coordenada de parsers, API e APK.
- Cabeçalhos impedem enquadramento e objetos incorporados. A página principal usa CSP com nonce exclusivo por resposta para scripts e estilos Emotion; atributos de estilo inline continuam permitidos para componentes MUI dinâmicos. Em desenvolvimento, scripts permitem eval para ferramentas Next.js; produção não. Lint React dedicado usa Biome 2.2.6 com regras de hooks, dependências e chaves JSX; a versão da ferramenta é fixada no comando bunx, sem dependência de runtime. O código gerado OpenAPI é excluído. Typecheck, Playwright e axe complementam a cobertura. Typecheck e Playwright continuam obrigatórios.

## Backend

- Limites de dados de saúde, proteção de XP e votos, idempotência do treino e correções de atividades Strava. Deduplicação entre fontes com horários registrados (Health Connect, Strava, Apple, Samsung e GPX) é conservadora: mesmo instante, duração, tipo normalizado e distância compatível. CSV fica excluído da deduplicação entre fontes, pois pode usar horários sintéticos. Não concilia histórico já duplicado ou registros com horários/tipos diferentes. A segunda fonte de um registro duplicado não é persistida separadamente.
- Revogação Strava via OAuth revoke e preservação do token rotacionado em falhas. Conexões são adquiridas após consultas externas Strava e liberadas antes de Gemini. Limite Gemini continua por processo; não foi adicionada infraestrutura de filas/cache.
- Readiness verifica presença das tabelas esperadas. Relatórios ordenam instantes reais, tratando horários antigos inválidos como ausentes (PostgreSQL 16+; CI usa PostgreSQL 18). Migrações históricas, IDs, cookie legado e colunas auth_* são mantidos por compatibilidade com sessões, APKs e bases existentes. Não excluir ou alterar produção sem plano de migração.
- Backup aceita nomes MURIM_BACKUP_* com fallback legado; CI testa restauração de uma base descartável. Homologação do backup real e do schema Neon de destino continua pendente.
- Health Connect mantém a janela de 30 dias. Reconciliação de exclusões, alterações antigas, ausência explícita de medições e possíveis duplicatas entre todas as fontes requer etapa própria.

- Relatórios não apresentam calorias GPX antigas estimadas como medições: excluem-nas dos agregados e preservam o registro original. Outros zeros legados ainda podem ser ambíguos.
