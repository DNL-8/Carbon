# Homologação: autenticação Google em Python

Esta branch oferece uma alternativa opt-in ao Better Auth. Não habilite em produção
antes de homologar o Google real (web e Android). O modo padrão continua legado
para permitir reversão e executar a suíte de regressão existente.

## Configuração privada

- Use um PostgreSQL de homologação, com o esquema existente do Murim, nunca a base
  de produção para os testes automatizados.
- Em FastAPI: configure DATABASE_URL, AUTH_PROVIDER=authlib, GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET, PYTHON_AUTH_SECRET (aleatório, com pelo menos 32 caracteres)
  e BETTER_AUTH_URL (a origem pública HTTPS; nome legado para compatibilidade).
- GOOGLE_USERS é um objeto JSON com até dois pares de identificador Google (claim
  sub) para ID interno existente. Use os valores reais somente no ambiente privado.
  Exemplo fictício: {"google-sub-1":"murim-id-1","google-sub-2":"murim-id-2"}.
  Confirme cada vínculo com o provedor antes de ativar. Para contas já vinculadas,
  a consulta de referência é SELECT account_id,user_id FROM auth_account WHERE
  provider_id='google'. Não copie credenciais ou IDs reais para este repositório.
  Contas sem vínculo Google exigem provisionamento verificado; não há vinculação
  automática por e-mail, criação pública de conta ou redefinição de senha.
- Configure o cliente Google com a URI de retorno exata da origem pública +
  /api/auth/callback/google. O Android mantém o contrato de ID token e cookie.
- Em Next.js: MURIM_AUTH_PROVIDER=authlib, MURIM_FASTAPI_ORIGIN apontando ao
  FastAPI. O modo deve coincidir com AUTH_PROVIDER do backend. Não há necessidade
  de MURIM_AUTH_ORIGIN nem AUTH_ORIGIN neste modo.
- ENABLE_WRITES=true somente após preparar o banco e confirmar a configuração.
- Gemini, Strava e Health Connect mantêm seus contratos e configurações existentes.

## Segurança e continuidade

A sessão usa token aleatório, hash SHA-256 no banco e validade de sete dias.
Cookies de sessão são HttpOnly, SameSite=Lax e Secure em HTTPS. A origem deve
coincidir nas operações de escrita. OAuth web usa state, PKCE S256 e nonce; o
callback não aceita destinos arbitrários. IDs Google e e-mails verificados
são conferidos no servidor. O ID token Android é de uso único até expirar.
O armazenamento e as tabelas existentes são reaproveitados: nenhuma migração
destrutiva nem novo ID de usuário. Sessões antigas não são aceitas no modo novo;
os dois usuários deverão entrar novamente. O nome de cookie legado foi mantido
para compatibilidade com o APK, mas o conteúdo e o hash têm namespace próprio.

Antes da troca, validar: login de ambas as contas, rejeição de uma terceira,
logout/revogação, expiração, Android físico, isolamento de XP/treinos/saúde,
revisão visual e testes reais de Google, Gemini e Health Connect. Validar também
a proteção de logs do callback, limite de requisições e segredos do ambiente.
Não remover o Nitro/Nuxt nem o Better Auth antes da homologação e reversão.

## Reversão

Voltar AUTH_PROVIDER=better-auth e MURIM_AUTH_PROVIDER=better-auth, restaurar
as origens Nitro e iniciar o serviço legado. Os IDs e os dados de negócio
permanecem iguais. Solicitar novo login e não copiar tokens entre implementações.
