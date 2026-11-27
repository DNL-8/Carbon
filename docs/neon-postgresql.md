# PostgreSQL / Neon

Use DATABASE_URL para a aplicação e MURIM_MIGRATION_DATABASE_URL para Alembic (conexão direta). Preserve IDs, saldos e histórico. Não execute testes nem bootstrap de banco vazio contra produção. Consulte backend/README.md.

O baseline exige as tabelas `auth_*` e `fitness_*` com as colunas e restrições esperadas. O catálogo consultado no projeto Neon `murim` em 27/11/2026 apresentou `users`, `game_stats` e `workout_logs`, entre outras tabelas de um schema diferente. Se esse for o banco da aplicação, confirme a origem dos dados e valide uma migração de dados em uma branch isolada antes de qualquer alteração na origem. Use `alembic upgrade head` em uma cópia para verificar a compatibilidade. Não use `alembic stamp` para contornar uma divergência.

O backup criptografado usa scripts/postgres-backup.sh com PGDATABASE e AGE_RECIPIENT; o workflow aceita MURIM_BACKUP_ENABLED, MURIM_BACKUP_DATABASE_URL e MURIM_BACKUP_AGE_RECIPIENT, com fallback para as chaves NUXT_BACKUP_* existentes. Configure e valide as novas chaves antes de remover as antigas; uma flag MURIM_BACKUP_ENABLED=false desativa o backup mesmo se a antiga estiver ativa. O nome histórico não representa dependência de Nuxt. Teste restauração em banco isolado, nunca na base original.

Antes de preparar uma transferência do schema legado, siga o [pré-voo e plano de migração](migracao-legado.md). O script é somente leitura e não autoriza a migração.
