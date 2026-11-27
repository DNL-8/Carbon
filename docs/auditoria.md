# Acompanhamento da auditoria

A arquitetura Next.js/FastAPI permanece inalterada. Correções de auditoria são verificadas em PostgreSQL descartável, sem acesso a dados reais.

## Frontend

- Catálogos de treinos e equipamentos extraídos de rpgLogic.ts, mantendo exports e os oráculos de paridade.
- Removidos módulos sem referências de tipos antigos, wrappers RPG, erros Firebase e paginação documentId. Fila offline antiga, alertas de descanso e animações são preservados para avaliação de funcionalidades e dados locais existentes.
- Reenvio de treinos finalizados usa armazenamento local versionado por conta. Não guarda tokens; o navegador não fornece criptografia própria para esse conteúdo. Em dispositivo compartilhado, descarte cópias pendentes explicitamente. Rascunhos novos ainda não finalizados podem ser retomados após recarregar: séries, exercício atual e tempo decorrido são salvos por conta; retomada pausada não conta o intervalo fora da tela. Um rascunho por conta e navegador; não editar o mesmo treino em múltiplas abas. A fila antiga não é migrada automaticamente.
- Importação CSV não inventa duração ou calorias. Limites de arquivos reduzem o risco de bloqueio do navegador. Contrato legado ainda não distingue todos os zeros e ausências de todas as fontes; transformação completa exige revisão coordenada de parsers, API e APK.
- Cabeçalhos impedem enquadramento e objetos incorporados. CSP com nonce para scripts/estilos e lint React dedicado permanecem pendentes. Typecheck e Playwright continuam obrigatórios.

## Backend

- Limites de dados de saúde, proteção de XP e votos, idempotência do treino e correções de atividades Strava. Deduplicação entre Health Connect/Strava é conservadora: mesmo instante, duração e distância compatível. Não concilia histórico já duplicado, arquivos manuais ou registros com identificadores/timestamps diferentes. A segunda fonte de um registro duplicado não é persistida separadamente.
- Revogação Strava via OAuth revoke e preservação do token rotacionado em falhas. Conexões são adquiridas após consultas externas Strava e liberadas antes de Gemini. Limite Gemini continua por processo; não foi adicionada infraestrutura de filas/cache.
- Readiness verifica presença das tabelas esperadas. Migrações históricas, IDs, cookie legado e colunas auth_* são mantidos por compatibilidade com sessões, APKs e bases existentes. Não excluir ou alterar produção sem plano de migração.
- Backup aceita nomes MURIM_BACKUP_* com fallback legado; CI testa restauração de uma base descartável. Homologação do backup real e do schema Neon de destino continua pendente.
- Health Connect mantém a janela de 30 dias. Reconciliação de exclusões, alterações antigas, ausência explícita de medições e possíveis duplicatas entre todas as fontes requer etapa própria.
