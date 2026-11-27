import { useCallback, useEffect, useState } from 'react';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  getAuth,
  linkWithCredential,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updatePassword,
  updateProfile,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AppAuthUser } from '../types/auth';

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
auth.languageCode = 'pt';

if (typeof window !== 'undefined') {
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
}

export const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { EmailAuthProvider };

async function syncUserProfileDocument(firebaseUser: FirebaseUser): Promise<void> {
  try {
    const { ensureUserDocument } = await import('./firestoreWorkspace');
    await ensureUserDocument(firebaseUser);
  } catch {
    // Sync inicial do documento é opcional durante o login
  }
}

export interface FirebaseAuthSessionData {
  user: AppAuthUser;
  apiToken: string | null;
}

interface ClientAuthState {
  user: AppAuthUser | null;
  apiToken: string | null;
}

const memoryState: ClientAuthState = {
  user: null,
  apiToken: null,
};

function resolveProviderName(firebaseUser: FirebaseUser): 'google' | 'password' {
  const hasGoogle = firebaseUser.providerData.some((p) => p.providerId === 'google.com');
  return hasGoogle ? 'google' : 'password';
}

export function firebaseUserToAppAuthUser(firebaseUser: FirebaseUser | null): AppAuthUser | null {
  if (!firebaseUser) return null;
  const provider = resolveProviderName(firebaseUser);
  const hasGoogle = provider === 'google';
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? null,
    displayName: firebaseUser.displayName ?? null,
    image: firebaseUser.photoURL ?? null,
    emailVerified: firebaseUser.emailVerified || hasGoogle,
    provider,
  };
}

export function toAppAuthUser(
  session: FirebaseAuthSessionData | { user?: Partial<AppAuthUser> | null } | null | undefined
): AppAuthUser | null {
  const u = session?.user;
  if (!u || typeof u.uid !== 'string' || !u.uid) return null;
  return {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    image: u.image ?? null,
    emailVerified: u.emailVerified !== false,
    provider: typeof u.provider === 'string' ? u.provider : undefined,
  };
}

const OFFLINE_USER_STORAGE_KEY = 'hunterfit_offline_user_v1';

export function saveOfflineUserSnapshot(user: AppAuthUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!user) {
      window.localStorage.removeItem(OFFLINE_USER_STORAGE_KEY);
      return;
    }
    const safeSnapshot: AppAuthUser = {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified !== false,
      provider: user.provider,
    };
    window.localStorage.setItem(OFFLINE_USER_STORAGE_KEY, JSON.stringify(safeSnapshot));
  } catch {
    // Storage local opcional quando bloqueado
  }
}

export function readOfflineUserSnapshot(): AppAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppAuthUser> | null;
    if (!parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim()) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
      image: typeof parsed.image === 'string' ? parsed.image : null,
      emailVerified: parsed.emailVerified !== false,
      provider: typeof parsed.provider === 'string' ? parsed.provider : undefined,
    };
  } catch {
    return null;
  }
}

export function clearOfflineUserSnapshot(): void {
  saveOfflineUserSnapshot(null);
}

export function syncClientAuthSession(
  session: FirebaseAuthSessionData | null | undefined
): AppAuthUser | null {
  const mapped = toAppAuthUser(session);
  memoryState.user = mapped;
  memoryState.apiToken = mapped && typeof session?.apiToken === 'string' ? session.apiToken : null;
  return mapped;
}

export function clearClientAuthState(): void {
  memoryState.user = null;
  memoryState.apiToken = null;
}

export function getClientAuthState(): ClientAuthState {
  return {
    user: memoryState.user,
    apiToken: memoryState.apiToken,
  };
}

export async function refreshClientAuthToken(forceRefresh = true): Promise<ClientAuthState> {
  const current = auth.currentUser;
  if (!current) {
    clearClientAuthState();
    return getClientAuthState();
  }
  try {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      await current.reload();
    }
  } catch {
    // Continua com token em cache se reload falhar por rede
  }
  const latest = auth.currentUser ?? current;
  let token: string | null = null;
  try {
    token = await latest.getIdToken(forceRefresh);
  } catch {
    try {
      token = await latest.getIdToken(false);
    } catch {
      token = null;
    }
  }
  const mapped = firebaseUserToAppAuthUser(latest);
  memoryState.user = mapped;
  memoryState.apiToken = token;
  return getClientAuthState();
}

export function useSession() {
  const [data, setData] = useState<FirebaseAuthSessionData | null>(null);
  const [isPending, setIsPending] = useState<boolean>(true);

  const syncFromUser = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      clearClientAuthState();
      setData(null);
      setIsPending(false);
      return;
    }
    const mapped = firebaseUserToAppAuthUser(firebaseUser);
    let token: string | null = null;
    try {
      token = await firebaseUser.getIdToken();
    } catch {
      token = null;
    }
    if (mapped) {
      const sessionObj: FirebaseAuthSessionData = { user: mapped, apiToken: token };
      syncClientAuthSession(sessionObj);
      setData(sessionObj);
    } else {
      clearClientAuthState();
      setData(null);
    }
    setIsPending(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      void syncFromUser(firebaseUser);
    });
    return () => unsubscribe();
  }, [syncFromUser]);

  const refetch = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      clearClientAuthState();
      setData(null);
      setIsPending(false);
      return;
    }
    try {
      await current.reload();
    } catch {
      // Ignora erro transitório de reload
    }
    const refreshedUser = auth.currentUser ?? current;
    let token: string | null = null;
    try {
      token = await refreshedUser.getIdToken(true);
    } catch {
      token = null;
    }
    const mapped = firebaseUserToAppAuthUser(refreshedUser);
    if (mapped) {
      const sessionObj: FirebaseAuthSessionData = { user: mapped, apiToken: token };
      syncClientAuthSession(sessionObj);
      setData(sessionObj);
    }
    setIsPending(false);
  }, []);

  return { data, isPending, refetch };
}

export async function signInWithGoogle(): Promise<AppAuthUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  const mapped = firebaseUserToAppAuthUser(cred.user);
  if (!mapped) {
    throw new Error('Não foi possível obter os dados da Conta Google.');
  }
  const token = await cred.user.getIdToken();
  syncClientAuthSession({ user: mapped, apiToken: token });
  if (mapped.emailVerified) {
    await syncUserProfileDocument(cred.user).catch(() => undefined);
  }
  return mapped;
}

export async function signInWithEmail(email: string, password: string): Promise<AppAuthUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const mapped = firebaseUserToAppAuthUser(cred.user);
  if (!mapped) {
    throw new Error('Não foi possível autenticar sua conta.');
  }
  const token = await cred.user.getIdToken();
  syncClientAuthSession({ user: mapped, apiToken: token });
  if (mapped.emailVerified) {
    await syncUserProfileDocument(cred.user).catch(() => undefined);
  }
  return mapped;
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AppAuthUser> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const cleanName = name.trim().slice(0, 80);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName });
  }
  await sendEmailVerification(cred.user).catch(() => undefined);
  const mapped = firebaseUserToAppAuthUser(cred.user);
  if (!mapped) {
    throw new Error('Não foi possível concluir o cadastro.');
  }
  const token = await cred.user.getIdToken();
  syncClientAuthSession({ user: mapped, apiToken: token });
  return mapped;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function resendVerificationEmail(): Promise<void> {
  const current = auth.currentUser;
  if (!current) {
    throw Object.assign(new Error('Usuário não autenticado.'), { code: 'unauthenticated' });
  }
  await sendEmailVerification(current);
}

export async function refreshVerificationStatus(): Promise<AppAuthUser | null> {
  const state = await refreshClientAuthToken(true);
  if (auth.currentUser?.emailVerified) {
    await syncUserProfileDocument(auth.currentUser).catch(() => undefined);
  }
  return state.user;
}

export interface AccountSecurityInfo {
  uid: string;
  email: string | null;
  provider: string;
  emailVerified: boolean;
  hasLocalPassword: boolean;
  linkedViaEmail: boolean;
  hasSeparateEmailAccount: boolean;
  canSetLocalPassword: boolean;
}

export async function getAccountSecurityInfo(user?: AppAuthUser | null): Promise<AccountSecurityInfo> {
  const current = auth.currentUser;
  const providerIds = new Set(current?.providerData.map((p) => p.providerId) ?? []);
  const hasGoogle = providerIds.has('google.com') || user?.provider === 'google';
  const hasPassword = providerIds.has('password') || user?.provider === 'password';
  const email = current?.email ?? user?.email ?? null;
  const uid = current?.uid ?? user?.uid ?? '';
  const emailVerified = Boolean(current?.emailVerified || user?.emailVerified || hasGoogle);

  return {
    uid,
    email,
    provider: hasGoogle ? 'google' : 'password',
    emailVerified,
    hasLocalPassword: hasPassword,
    linkedViaEmail: hasGoogle && hasPassword,
    hasSeparateEmailAccount: false,
    canSetLocalPassword: Boolean(email),
  };
}

export async function setOrUpdateAccountPassword(payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ updated: boolean; linkedViaEmail: boolean }> {
  const current = auth.currentUser;
  if (!current || !current.email) {
    throw Object.assign(new Error('Faça login novamente para atualizar a senha.'), {
      code: 'unauthenticated',
    });
  }

  const providerIds = new Set(current.providerData.map((p) => p.providerId));
  const hasPassword = providerIds.has('password');

  if (hasPassword) {
    if (!payload.currentPassword) {
      throw Object.assign(new Error('Informe a senha atual para confirmar a alteração.'), {
        code: 'invalid_current_password',
      });
    }
    const cred = EmailAuthProvider.credential(current.email, payload.currentPassword);
    await reauthenticateWithCredential(current, cred);
    await updatePassword(current, payload.newPassword);
    return { updated: true, linkedViaEmail: false };
  }

  const emailCred = EmailAuthProvider.credential(current.email, payload.newPassword);
  try {
    await linkWithCredential(current, emailCred);
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: unknown }).code === 'auth/requires-recent-login'
    ) {
      await reauthenticateWithPopup(current, googleProvider);
      await linkWithCredential(current, emailCred);
    } else {
      throw err;
    }
  }
  await current.reload().catch(() => undefined);
  return { updated: true, linkedViaEmail: true };
}

export async function signOut(): Promise<void> {
  clearClientAuthState();
  clearOfflineUserSnapshot();
  await firebaseSignOut(auth);
}
