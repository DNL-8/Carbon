import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Context } from 'hono';
import firebaseConfig from '../../firebase-applet-config.json';
import { ApiHttpError } from './apiError.ts';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  name?: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  token: string;
}

const VALID_UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function getFirebaseAdminAuth() {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({ projectId: firebaseConfig.projectId });
  return getAuth(app);
}

export async function verifyBearerToken(
  authHeader: string | undefined,
  options: { allowUnverified?: boolean } = {}
): Promise<AuthenticatedUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiHttpError(
      401,
      'Autenticação obrigatória. Faça login antes de acessar a API.',
      'missing_bearer_token'
    );
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 16_384 || token.split('.').length !== 3) {
    throw new ApiHttpError(401, 'Token de autenticação inválido.', 'invalid_token_format');
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    if (!decoded.uid || !VALID_UID_REGEX.test(decoded.uid)) {
      throw new ApiHttpError(401, 'Identificador de conta inválido na sessão.', 'invalid_subject');
    }

    const isGoogleProvider = decoded.firebase?.sign_in_provider === 'google.com';
    const isVerified = decoded.email_verified === true || isGoogleProvider;

    if (!isVerified && options.allowUnverified !== true) {
      throw new ApiHttpError(
        403,
        'Sua conta precisa ter o e-mail verificado para acessar os dados do aplicativo.',
        'email_not_verified'
      );
    }

    return {
      uid: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : null,
      name: typeof decoded.name === 'string' ? decoded.name : null,
      emailVerified: isVerified,
      isAdmin: false,
      token,
    };
  } catch (err) {
    if (err instanceof ApiHttpError) throw err;
    throw new ApiHttpError(
      401,
      'Token do Firebase Auth inválido ou expirado. Entre novamente.',
      'token_expired'
    );
  }
}

export async function authenticateRequest(
  c: Context,
  _allowedOrigins?: Set<string>,
  options: { allowUnverified?: boolean } = {}
): Promise<AuthenticatedUser> {
  const authHeader = c.req.header('authorization');
  return verifyBearerToken(authHeader, options);
}
