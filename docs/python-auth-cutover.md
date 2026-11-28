# Autenticação privada Google

FastAPI/Authlib é a única implementação. Configure em segredo APP_ORIGIN (HTTPS em produção), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PYTHON_AUTH_SECRET (aleatório, mínimo 32 caracteres), DATABASE_URL e GOOGLE_USERS (JSON com um ou mais pares de Google sub para IDs internos distintos já existentes). Confirme a identidade de cada conta; contas previamente vinculadas podem ser identificadas por consulta privada a auth_account (provider_id='google'). Não associe automaticamente por e-mail. Não envie segredos nem IDs ao Git.

Configure a URI de callback exata APP_ORIGIN + /api/auth/callback/google no Google Cloud. O Android usa o mesmo contrato de ID token e cookie; o nome histórico do cookie foi preservado por compatibilidade, não existe serviço de autenticação externo TypeScript. Sessões antigas não são aceitas. O token aleatório é armazenado em hash SHA-256, expira em sete dias e pode ser revogado. OAuth usa state, PKCE e nonce; escritas exigem a origem pública exata.

Não há cadastro público, login por senha ou modo visitante. Antes de habilitar uso real, configure as identidades autorizadas, valide login web e Android, logout, isolamento de dados, Gemini e Health Connect físico. Configure MURIM_FASTAPI_ORIGIN no frontend.

## Autorização do Arsenal V2

As rotas de leitura exigem sessão válida e as escritas exigem a autorização de origem já adotada. Aquisição e equipamento são validados para a identidade autenticada pelo FastAPI; nenhum ID de proprietário fornecido pelo cliente controla o inventário. O modo de aquisição, preço e requisito vêm do catálogo do servidor. Teste resgate e compra com as duas contas sintéticas conforme [homologação](homologacao.md). A expansão não altera o protocolo Google OAuth nem os cookies de sessão.
