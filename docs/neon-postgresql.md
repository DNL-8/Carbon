# PostgreSQL / Neon

Use DATABASE_URL para a aplicação e MURIM_MIGRATION_DATABASE_URL para Alembic (conexão direta). Preserve IDs, saldos e histórico. Não execute testes nem bootstrap de banco vazio contra produção. Consulte backend/README.md.

O baseline exige as tabelas `auth_*` e `fitness_*` com as colunas e restrições esperadas. O catálogo consultado no projeto Neon `murim` em 27/11/2026 apresentou `users`, `game_stats` e `workout_logs`, entre outras tabelas de um schema diferente. Se esse for o banco da aplicação, confirme a origem dos dados e valide uma migração de dados em uma branch isolada antes de qualquer alteração na origem. Use `alembic upgrade head` em uma cópia para verificar a compatibilidade. Não use `alembic stamp` para contornar uma divergência.

O backup criptografado usa scripts/postgres-backup.sh com PGDATABASE e AGE_RECIPIENT; o workflow aceita MURIM_BACKUP_ENABLED, MURIM_BACKUP_DATABASE_URL e MURIM_BACKUP_AGE_RECIPIENT, com fallback para as chaves NUXT_BACKUP_* existentes. Configure e valide as novas chaves antes de remover as antigas; uma flag MURIM_BACKUP_ENABLED=false desativa o backup mesmo se a antiga estiver ativa. O nome histórico não representa dependência de Nuxt. Teste restauração em banco isolado, nunca na base original.

Antes de preparar uma transferência do schema legado, siga o [pré-voo e plano de migração](migracao-legado.md). O script é somente leitura e não autoriza a migração.

## Arsenal V2 e persistência

A expansão do catálogo usa os campos existentes de `fitness_arsenal` (owned, equipped, loadouts) e o saldo de `fitness_progress`. Compras registram `fitness_progress_ledger`; resgates não debitam moedas. A serialização por proprietário ocorre na transação de progresso. Não é necessária nova migração Alembic exclusivamente para o Arsenal V2; isso não comprova compatibilidade do schema legado. Teste aquisição simultânea em PostgreSQL descartável conforme [CI](ci.md) e [Arsenal](plano-arsenal.md).

## Inspeção somente leitura — 28/11/2026

No projeto murim, a branch padrão possui dois bancos: `carbon` com as 17 tabelas de aplicação e a tabela de versão Alembic (`0001_drizzle_baseline`), e `neondb` com o schema legado. O banco carbon é candidato ao ambiente novo, mas ainda não foi comprovada a configuração do deployment nem a equivalência de todas as restrições/índices. Nenhuma consulta a conteúdo de registros ou alteração foi feita. O histórico de migração anterior continua válido para neondb.

## Atualização de produção — 28/11/2026

O deployment Carbon na Vercel confirmou /api/ready e a criação de conta, vínculo Google, perfil e progressão no banco `carbon`. O banco `neondb` legado permanece separado. Configure o backup com a conexão direta do banco `carbon`, nunca reutilize uma URL legada sem verificar o destino. A restauração criptografada em banco descartável passou na CI, mas o backup de produção ainda precisa ser validado. Não transfira chaves privadas para o GitHub.
