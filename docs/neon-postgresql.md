# Neon PostgreSQL — configuração, migrações e backup

A arquitetura Nuxt usa PostgreSQL com Drizzle e Better Auth, não Firebase/Firestore. O schema autoritativo está em `web/server/db/schema.ts`; os oito arquivos SQL e seus metadados em `web/drizzle/` devem permanecer versionados.

## Conexões

- `DATABASE_URL`: conexão de aplicação, preferencialmente pooled no Neon.
- `DATABASE_URL_DIRECT`: conexão direta, usada por `web/drizzle.config.ts`.
- Configure ambas apenas em ambiente autorizado e nunca as exponha no repositório ou em capturas.

O projeto Neon compatível com Nuxt foi configurado separadamente do banco antigo Murim. Não aponte a aplicação ao banco antigo apenas por conter usuários; as tabelas são incompatíveis. Better Auth usa tabelas `auth_*`; dados RPG/saúde usam tabelas `fitness_*`.

Em banco de desenvolvimento vazio ou branch isolada, execute `bun run db:migrate`. Revise qualquer nova migração e faça backup antes de alterações produtivas. Não use a produção para testes ou restauração.

## Backup automatizado

Workflow: `.github/workflows/nuxt-backup.yml`. Segunda-feira 06:30 UTC (03:30 em Brasília), ou execução manual. Usa `scripts/nuxt-backup.sh`, pg_dump em PostgreSQL 18 e age. Retenção de artefatos: 30 dias.

Configure em Settings → Secrets and variables → Actions **no repositório**:

| Tipo | Nome |
| --- | --- |
| Secret | NUXT_BACKUP_DATABASE_URL |
| Variable | NUXT_BACKUP_AGE_RECIPIENT |
| Variable | NUXT_BACKUP_ENABLED (true) |

A chave age privada deve ficar fora do GitHub, guardada separadamente. O segredo do backup precisa corresponder ao banco a proteger. O backup antigo foi validado, mas isso não comprova que o banco ativo esteja coberto. Verifique o destino antes de considerar a rotina concluída; preserve o backup antigo.

Para ensaiar restauração, baixe o artefato e use um banco **isolado**:

```bash
age --decrypt -i /caminho/chave.agekey -o nuxt-test.dump nuxt-postgres.dump.age
pg_restore --exit-on-error --no-owner --no-acl --dbname="$DATABASE_RESTORE_URL" nuxt-test.dump
```

Confira tabelas, contagens e fluxos de conta/treino. Apague a cópia descriptografada ao terminar. A CI executa backup e restauração sintéticos em PostgreSQL 18; não restaura o banco produtivo.

## Dados históricos

A migração de contas e histórico do banco anterior/Firebase é trabalho separado: inventário, backup, mapeamento de identidades verificadas, deduplicação, ensaio isolado e revisão. Não apagar fontes nem unir contas só pelo e-mail.
