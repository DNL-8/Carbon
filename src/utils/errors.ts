export function getFriendlyErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-login-credentials':
      case 'invalid_credentials':
      case 'CredentialsSignin':
        return 'E-mail ou senha inválidos. Verifique os dados e tente novamente.';
      case 'auth/invalid-email':
        return 'Informe um endereço de e-mail válido.';
      case 'auth/email-already-in-use':
      case 'email_already_registered':
        return 'Este e-mail já está cadastrado. Acesse pela aba "Entrar".';
      case 'auth/weak-password':
        return 'A senha é muito fraca. Utilize pelo menos 8 caracteres combinando letras e números.';
      case 'auth/operation-not-allowed':
        return 'O provedor de login por E-mail/Senha precisa estar ativado no Firebase Authentication.';
      case 'auth/unauthorized-domain': {
        const host =
          typeof window !== 'undefined' && window.location?.hostname
            ? window.location.hostname
            : '';
        return host
          ? `O domínio "${host}" não está autorizado no Firebase Authentication. Adicione-o em Firebase Console → Authentication → Settings → Authorized domains.`
          : 'Este domínio não está autorizado no Firebase Authentication. Adicione o domínio do app em Firebase Console → Authentication → Settings → Authorized domains.';
      }
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
      case 'popup_closed':
        return 'A janela de autenticação foi fechada antes de concluir.';
      case 'auth/popup-blocked':
      case 'popup_blocked':
      case 'popup_failed_to_open':
        return 'O navegador bloqueou a janela de login. Permita popups para continuar.';
      case 'auth/too-many-requests':
      case 'rate_limit_exceeded':
        return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
      case 'auth/requires-recent-login':
        return 'Por segurança, entre novamente antes de alterar sua senha.';
      case 'auth/network-request-failed':
        return 'Falha de conexão ao autenticar com o Firebase. Verifique sua internet.';
      case 'auth/user-disabled':
        return 'Esta conta foi desativada.';
      case 'auth/credential-already-in-use':
      case 'linked_account_has_data':
        return 'Esta credencial já está vinculada a outro perfil.';
      case 'invalid_current_password':
        return 'A senha atual informada está incorreta.';
      case 'unauthenticated':
      case 'missing_bearer_token':
      case 'token_expired':
      case 'invalid_token':
        return 'Sua sessão expirou. Entre novamente para continuar.';
      case 'email_not_verified':
        return 'Sua conta precisa ter o e-mail verificado para acessar os dados.';
      case 'permission-denied':
      case 'permission_denied':
        return 'Permissão negada no Firestore. Verifique se você está autenticado e com e-mail verificado.';
      case 'unavailable':
        return 'O Cloud Firestore está temporariamente indisponível. Tente novamente em instantes.';
      case 'failed-precondition':
        return 'Operação recusada pela condição atual do banco. Recarregue e tente novamente.';
      default:
        break;
    }
  }

  if (err instanceof Error && err.message) {
    const trimmed = err.message.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { error?: string; operationType?: string };
        if (typeof parsed.error === 'string') {
          if (/permission|insufficient/i.test(parsed.error)) {
            return 'Permissão negada no Cloud Firestore. Verifique seu login e e-mail verificado.';
          }
          if (/offline|unavailable/i.test(parsed.error)) {
            return 'Sem conexão com o Cloud Firestore no momento.';
          }
          return parsed.error;
        }
      } catch {
        // Fallback para mensagem original
      }
    }
    return err.message;
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}
