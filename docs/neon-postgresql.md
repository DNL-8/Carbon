# PostgreSQL / Neon

Use DATABASE_URL para a aplicação e MURIM_MIGRATION_DATABASE_URL para Alembic (conexão direta). Preserve IDs, saldos e histórico. Não execute testes nem bootstrap de banco vazio contra produção. Consulte backend/README.md.

O backup criptografado usa scripts/postgres-backup.sh com PGDATABASE e AGE_RECIPIENT; o workflow mantém as chaves de configuração NUXT_BACKUP_* existentes para evitar desativar backups já configurados. O nome histórico não representa dependência de Nuxt. Teste restauração em banco isolado, nunca na base original.
