# PostgreSQL / Neon

Use DATABASE_URL para a aplicação e MURIM_MIGRATION_DATABASE_URL para Alembic (conexão direta). Preserve IDs, saldos e histórico. Não execute testes nem bootstrap de banco vazio contra produção. Consulte backend/README.md.

O baseline exige as tabelas `auth_*` e `fitness_*` com as colunas e restrições esperadas. O catálogo consultado no projeto Neon `murim` em 27/11/2026 apresentou `users`, `game_stats` e `workout_logs`, entre outras tabelas de um schema diferente. Se esse for o banco da aplicação, confirme a origem dos dados e valide uma migração de dados em uma branch isolada antes de qualquer alteração na origem. Use `alembic upgrade head` em uma cópia para verificar a compatibilidade. Não use `alembic stamp` para contornar uma divergência.

O backup criptografado usa scripts/postgres-backup.sh com PGDATABASE e AGE_RECIPIENT; o workflow mantém as chaves de configuração NUXT_BACKUP_* existentes para evitar desativar backups já configurados. O nome histórico não representa dependência de Nuxt. Teste restauração em banco isolado, nunca na base original.
