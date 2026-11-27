# CI centralizado

O workflow Murim CI é a única validação automática de código (push na main e PR para main). São dois jobs em paralelo:

- Aplicação: PostgreSQL descartável, migrações Drizzle/Alembic, oráculos de regressão, Ruff, pytest, auditoria de dependências, contêiner FastAPI, build Next.js, contratos e tipos, Playwright desktop/mobile (inclusive Authlib), e paridade Nuxt/FastAPI para reversão.
- Android: testes unitários Kotlin e APK debug.

A instalação do banco, dependências compartilhadas, build Nuxt e Chromium são executados uma vez no job de aplicação. Os workflows FastAPI e Next.js separados foram incorporados ao CI. As verificações do frontend legado e a matriz completa do Nuxt (incluindo restauração de backup de teste) podem ser executadas manualmente em Actions, se necessário. O backup agendado real e a verificação manual de revisão publicada não foram alterados.

Antes de mesclar, confira as regras de proteção da main: se elas exigirem nomes de checks antigos, substitua pelos dois novos checks. Não desative proteção de branch. A remoção dos serviços legados depende da homologação do Authlib.
