import React, { useState } from 'react';
import {
  ArrowsClockwise,
  EnvelopeSimple,
  Fire,
  Heartbeat,
  Lock,
  ShieldCheck,
  Sword,
  User as UserIcon,
} from '@phosphor-icons/react';
import {
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
} from '../services/authClient';
import { getFriendlyErrorMessage } from '../utils/errors';
import { ErrorBanner } from './StatusFeedback';

interface AuthScreenProps {
  authError: string | null;
  onError: (msg: string) => void;
  clearError: () => void;
  onAuthSuccess: () => Promise<void>;
}

type CredentialsTab = 'login' | 'register' | 'recover';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  authError,
  onError,
  clearError,
  onAuthSuccess,
}) => {
  const [googleSubmitting, setGoogleSubmitting] = useState<boolean>(false);
  const [tab, setTab] = useState<CredentialsTab>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [credSubmitting, setCredSubmitting] = useState<boolean>(false);

  const handleGoogleLogin = async (): Promise<void> => {
    clearError();
    setRecoveryMessage(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      await onAuthSuccess();
    } catch (err: unknown) {
      onError(getFriendlyErrorMessage(err));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    clearError();
    setRecoveryMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      onError('Informe um endereço de e-mail válido.');
      return;
    }

    if (tab === 'recover') {
      setCredSubmitting(true);
      try {
        await requestPasswordReset(cleanEmail);
        setRecoveryMessage(
          'Se o e-mail estiver cadastrado, enviamos um link do Firebase Authentication para você redefinir sua senha.'
        );
      } catch (err: unknown) {
        onError(getFriendlyErrorMessage(err));
      } finally {
        setCredSubmitting(false);
      }
      return;
    }

    if (password.length < 8) {
      onError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (tab === 'register' && cleanName.length < 2) {
      onError('Informe seu nome (mínimo 2 caracteres).');
      return;
    }

    setCredSubmitting(true);
    try {
      if (tab === 'register') {
        await registerWithEmail(cleanName, cleanEmail, password);
      } else {
        await signInWithEmail(cleanEmail, password);
      }
      await onAuthSuccess();
    } catch (err: unknown) {
      onError(getFriendlyErrorMessage(err));
    } finally {
      setCredSubmitting(false);
    }
  };

  const busy = googleSubmitting || credSubmitting;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col justify-center px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0">
              <Sword size={18} strokeWidth={1.75} weight="regular" className="text-orange-400" />
            </div>
            <div>
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-zinc-500">
                Sistema de progressão & saúde
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Fitness <span className="text-[#F97316]">RPG</span>
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Monitore treinos reais via Strava, Apple Health, Samsung Health, GPX e CSV com sincronização em tempo real no Cloud Firestore.
          </p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5 text-xs text-zinc-300">
            <div className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-[#111113] border border-[#27272A]">
              <Heartbeat size={16} strokeWidth={1.75} weight="regular" className="text-orange-400 shrink-0 mt-0.5" />
              <span>Integração direta com Strava OAuth e arquivos Samsung Health, Apple Health, GPX e CSV.</span>
            </div>
            <div className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-[#111113] border border-[#27272A]">
              <Fire size={16} strokeWidth={1.75} weight="regular" className="text-orange-400 shrink-0 mt-0.5" />
              <span>Combate contra chefes, zonas cardíacas Z1–Z5, prontidão e Arsenal com Moedas de Ouro.</span>
            </div>
            <div className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-[#111113] border border-[#27272A]">
              <ShieldCheck size={16} strokeWidth={1.75} weight="regular" className="text-emerald-400 shrink-0 mt-0.5" />
              <span>Autenticação segura via Firebase Auth com Google ou e-mail e senha.</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={busy}
              className="w-full min-h-[42px] py-2 px-4 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 bg-[#F97316] hover:bg-orange-400 disabled:opacity-50 text-zinc-950 cursor-pointer disabled:cursor-not-allowed"
            >
              {googleSubmitting ? (
                <ArrowsClockwise size={18} strokeWidth={1.75} weight="regular" className="animate-spin" />
              ) : (
                <span className="w-5 h-5 rounded-sm font-bold text-xs flex items-center justify-center bg-zinc-950 text-white">
                  G
                </span>
              )}
              {googleSubmitting ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#27272A]" />
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              ou com e-mail
            </span>
            <div className="h-px flex-1 bg-[#27272A]" />
          </div>

          <ErrorBanner message={authError} onDismiss={clearError} />

          {recoveryMessage && (
            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/35 text-xs text-emerald-300">
              {recoveryMessage}
            </div>
          )}

          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-md bg-[#111113] border border-[#27272A]"
            role="tablist"
            aria-label="Modo de acesso por e-mail"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login' || tab === 'recover'}
              onClick={() => {
                clearError();
                setRecoveryMessage(null);
                setTab('login');
              }}
              className={`min-h-[36px] rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'login' || tab === 'recover'
                  ? 'bg-[#27272A] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => {
                clearError();
                setRecoveryMessage(null);
                setTab('register');
              }}
              className={`min-h-[36px] rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'register'
                  ? 'bg-[#27272A] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={(e) => void handleCredentialsSubmit(e)} className="space-y-3 text-left" noValidate>
            {tab === 'register' && (
              <div className="space-y-1">
                <label htmlFor="auth-name" className="block text-xs font-semibold text-zinc-300">
                  Nome do jogador
                </label>
                <div className="relative">
                  <UserIcon size={18} strokeWidth={1.75} weight="regular" className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome ou apelido"
                    maxLength={80}
                    className="w-full min-h-[42px] pl-10 pr-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="auth-email" className="block text-xs font-semibold text-zinc-300">
                E-mail
              </label>
              <div className="relative">
                <EnvelopeSimple size={18} strokeWidth={1.75} weight="regular" className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full min-h-[42px] pl-10 pr-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {tab !== 'recover' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-zinc-300">
                    Senha
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        clearError();
                        setRecoveryMessage(null);
                        setPassword('');
                        setTab('recover');
                      }}
                      className="text-[11px] font-medium text-orange-400 hover:text-orange-300 cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} strokeWidth={1.75} weight="regular" className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                    className="w-full min-h-[42px] pl-10 pr-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            {tab === 'recover' && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setRecoveryMessage(null);
                    setPassword('');
                    setTab('login');
                  }}
                  className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Voltar ao login
                </button>
                <span className="text-[11px] text-zinc-500">
                  Link enviado via Firebase Auth
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[42px] py-2 px-4 rounded-md disabled:opacity-50 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer bg-[#111113] hover:bg-zinc-800 border border-[#27272A] hover:border-orange-500/60 text-white"
            >
              {credSubmitting && (
                <ArrowsClockwise
                  size={18}
                  strokeWidth={1.75}
                  weight="regular"
                  className="animate-spin text-orange-400"
                />
              )}
              {credSubmitting
                ? tab === 'register'
                  ? 'Criando conta...'
                  : tab === 'recover'
                    ? 'Enviando...'
                    : 'Entrando...'
                : tab === 'register'
                  ? 'Criar conta e entrar'
                  : tab === 'recover'
                    ? 'Enviar link de recuperação'
                    : 'Entrar com e-mail'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
