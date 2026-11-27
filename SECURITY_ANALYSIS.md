# Segurança e endpoints — Murim Nuxt

## Arquitetura ativa

Better Auth autentica por sessão/cookie; `requireUser` exige sessão válida e e-mail verificado. Nitro executa operações Drizzle no PostgreSQL com filtro por usuário autenticado. O cliente não escolhe o proprietário das linhas. Recompensas, compras e importação são transacionais e as chaves de idempotência/deduplicação reduzem repetição.

O Nuxt Security configura limite de 150 requisições por minuto por instância. O limite não é distribuído. Schemas Zod validam entradas; a central de comandos usa allowlist de rotas e confirmação de escrita. Isso não substitui auditoria do servidor.

## Rotas

| Métodos | Caminho | Acesso |
| --- | --- | --- |
| GET | /api/health, /api/ready, /api/catalogo | Público |
| GET | /api/mobile/config, /api/strava/config | Configuração pública sem segredo |
| GET/POST | /api/auth/* | Better Auth; regras por operação |
| GET | /api/conta | Consulta de sessão |
| GET | /api/progresso, /api/painel, /api/estado, /api/conquistas, /api/extrato | Sessão verificada |
| GET/PUT | /api/heroi | Sessão verificada |
| GET/POST | /api/missao, /api/votos, /api/arsenal, /api/arsenal/conjuntos | Sessão verificada |
| GET | /api/treinos/historico, /api/treinos/personalizados | Sessão verificada |
| PUT/DELETE | /api/treinos/personalizados/:id | Sessão verificada |
| POST | /api/treinos/concluir | Sessão verificada; transação |
| GET | /api/saude/resumo | Sessão verificada |
| PUT/DELETE | /api/saude/peso | Sessão verificada |
| POST | /api/saude/importar | Sessão verificada |
| GET/POST | /api/saude/health-connect | Sessão verificada |
| GET | /api/strava/status, /api/strava/callback | Sessão verificada; callback valida state |
| POST | /api/strava/auth-url, /api/strava/sync, /api/strava/disconnect | Sessão verificada e origem |
| POST | /api/oracle/ask | Sessão verificada e limite por usuário |

## Proteção das integrações

Strava: estado OAuth cifrado com AES-256-GCM, expira em 10 minutos e é vinculado ao usuário. Cookies Secure/HttpOnly/SameSite=Lax, tokens não retornados em JSON. Desconexão local não revoga automaticamente o acesso no provedor. O escopo permite leitura de atividades privadas autorizadas.

Gemini: perguntas limitadas a 300 caracteres, intervalo local entre consultas e limite de 8 por minuto por usuário/instância. Métricas de saúde são opcionais e não são enviadas por padrão. Sem respostas fictícias; orientação não clínica. Não enviar credenciais, identificadores ou dados pessoais desnecessários.

Android: Google ID token verificado pelo Better Auth, cookie armazenado localmente com armazenamento criptografado, HTTPS e sessão da conta ativa. Health Connect envia dados autorizados, em lotes, para Nitro.

## Riscos e próximos controles

- Validar limites distribuídos, proteção CSRF/origem nas rotas de escrita, configurações reais de OAuth e isolamento em concorrência.
- Importações manuais e registros de treino são informados pelo usuário, não prova independente da execução; não usar XP como medida clínica.
- Revisar privacidade e duplicidade entre fontes distintas de saúde.
- Confirmar restauração do banco ativo e proteção dos segredos.
- Validar APK assinado, autorização e revogação em dispositivo real.
- Testes automatizados não equivalem a auditoria externa nem a paridade visual.

Veja [especificação](security_spec.md), [integrações](docs/integracoes-nuxt.md) e [checklist](CHECKLIST-MIGRACAO.md). A segurança Firebase histórica permanece no código e testes legados, não é a proteção do Nuxt.
