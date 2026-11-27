import { IconContext } from '@phosphor-icons/react';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBanner, SystemHudSkeleton } from './components/StatusFeedback';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  clearClientAuthState,
  clearOfflineUserSnapshot,
  readOfflineUserSnapshot,
  refreshClientAuthToken,
  refreshVerificationStatus,
  resendVerificationEmail,
  saveOfflineUserSnapshot,
  signOut,
  syncClientAuthSession,
  toAppAuthUser,
  useSession,
} from './services/authClient';
import { auth } from './services/firebase';
import { ensureUserDocument } from './services/firestoreWorkspace';
import type { AppAuthUser } from './types/auth';
import { getFriendlyErrorMessage } from './utils/errors';

const App = lazy(() => import('./App'));

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ size: 18, weight: 'regular', strokeWidth: 1.75 }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </IconContext.Provider>
  );
}

export default function AppEntry() {
  const { data: session, isPending, refetch } = useSession();
  const isOnline = useOnlineStatus();
  const [offlineUser, setOfflineUser] = useState<AppAuthUser | null>(() => readOfflineUserSnapshot());
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const errParam = new URLSearchParams(window.location.search).get('error');
    return errParam ? getFriendlyErrorMessage({ code: errParam }) : null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('error')) return;
    params.delete('error');
    const cleanQuery = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`
    );
  }, []);

  const status = useMemo<'loading' | 'authenticated' | 'unauthenticated'>(() => {
    if (isPending && !session) return 'loading';
    return session?.user ? 'authenticated' : 'unauthenticated';
  }, [isPending, session]);

  const sessionUser = useMemo(
    () => (status === 'authenticated' ? toAppAuthUser(session) : null),
    [session, status]
  );

  useEffect(() => {
    if (status === 'authenticated' && sessionUser) {
      syncClientAuthSession(session);
      saveOfflineUserSnapshot(sessionUser);
      setOfflineUser(sessionUser);
      if (sessionUser.emailVerified && auth.currentUser?.uid === sessionUser.uid) {
        void ensureUserDocument(auth.currentUser).catch(() => undefined);
      }
    } else if (status === 'unauthenticated') {
      clearClientAuthState();
      if (isOnline) {
        clearOfflineUserSnapshot();
        setOfflineUser(null);
      }
    }
  }, [session, sessionUser, status, isOnline]);

  useEffect(() => {
    if (isOnline && status === 'unauthenticated' && offlineUser) {
      void refetch();
    }
  }, [isOnline, status, offlineUser, refetch]);

  const authUser = sessionUser ?? (!isOnline ? offlineUser : null);

  if (status === 'loading' && (isOnline || !offlineUser)) {
    return (
      <AppProviders>
        <SystemHudSkeleton />
      </AppProviders>
    );
  }

  if (!authUser) {
    return (
      <AppProviders>
        <AuthScreen
          onError={setAuthError}
          authError={authError}
          clearError={() => setAuthError(null)}
          onAuthSuccess={async () => {
            const { user } = await refreshClientAuthToken();
            await refetch();
            if (user) {
              saveOfflineUserSnapshot(user);
              setOfflineUser(user);
            }
          }}
        />
      </AppProviders>
    );
  }

  if (!authUser.emailVerified) {
    const confirmLink = async () => {
      setCheckingEmail(true);
      setAuthError(null);
      setVerificationNote(null);
      try {
        const refreshed = await refreshVerificationStatus();
        await refetch();
        if (!refreshed?.emailVerified) {
          setAuthError(
            'Seu e-mail ainda não foi confirmado. Clique no link enviado para sua caixa de entrada e tente novamente.'
          );
        }
      } catch (error) {
        setAuthError(getFriendlyErrorMessage(error));
      } finally {
        setCheckingEmail(false);
      }
    };

    const resendLink = async () => {
      setCheckingEmail(true);
      setAuthError(null);
      setVerificationNote(null);
      try {
        await resendVerificationEmail();
        setVerificationNote(
          'Enviamos um novo link de confirmação para o seu e-mail. Verifique também a pasta de spam.'
        );
      } catch (error) {
        setAuthError(getFriendlyErrorMessage(error));
      } finally {
        setCheckingEmail(false);
      }
    };

    return (
      <AppProviders>
        <main className="grid min-h-screen place-items-center bg-[#09090B] px-4 text-zinc-100">
          <section className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-[#18181B] p-5">
            <h1 className="text-lg font-semibold">Verifique o e-mail da sua conta</h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Enviamos um link de confirmação via Firebase Authentication para{' '}
              <strong>{authUser.email ?? 'seu e-mail'}</strong>. Abra o link recebido e clique abaixo para liberar o acesso ao Cloud Firestore.
            </p>
            <ErrorBanner message={authError} onDismiss={() => setAuthError(null)} />
            {verificationNote && (
              <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                {verificationNote}
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={checkingEmail}
                onClick={() => void confirmLink()}
                className="rounded-md bg-orange-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {checkingEmail ? 'Verificando…' : 'Já confirmei meu e-mail'}
              </button>
              <button
                type="button"
                disabled={checkingEmail}
                onClick={() => void resendLink()}
                className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 disabled:opacity-50 cursor-pointer"
              >
                Reenviar link de verificação
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setVerificationNote(null);
                  clearClientAuthState();
                  clearOfflineUserSnapshot();
                  setOfflineUser(null);
                  void signOut().catch((error) =>
                    setAuthError(getFriendlyErrorMessage(error))
                  );
                }}
                className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 cursor-pointer"
              >
                Usar outra conta
              </button>
            </div>
          </section>
        </main>
      </AppProviders>
    );
  }

  return (
    <AppProviders>
      <Suspense fallback={<SystemHudSkeleton />}>
        <App key={authUser.uid} authUser={authUser} />
      </Suspense>
    </AppProviders>
  );
}
