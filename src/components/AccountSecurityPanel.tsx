import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Key, ShieldCheck } from '@phosphor-icons/react';
import { api } from '../services/api';
import type { AccountSecurityInfo } from '../services/authClient';
import type { AppAuthUser } from '../types/auth';
import { getFriendlyErrorMessage } from '../utils/errors';
import { ErrorBanner } from './HudPrimitives';

interface AccountSecurityPanelProps {
  user: AppAuthUser;
}

export const AccountSecurityPanel: React.FC<AccountSecurityPanelProps> = ({ user }) => {
  const [security, setSecurity] = useState<AccountSecurityInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.account.getSecurity(user);
      setSecurity(data);
    } catch {
      const isGoogle = user.provider === 'google';
      setSecurity({
        uid: user.uid,
        email: user.email ?? null,
        provider: isGoogle ? 'google' : 'password',
        emailVerified: user.emailVerified,
        hasLocalPassword: !isGoogle,
        linkedViaEmail: false,
        hasSeparateEmailAccount: false,
        canSetLocalPassword: Boolean(user.email),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const requiresCurrentPassword = Boolean(security?.hasLocalPassword);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (requiresCurrentPassword && !currentPassword) {
      setError('Informe a senha atual para confirmar a alteração.');
      return;
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.account.setPassword(
        {
          ...(currentPassword ? { currentPassword } : {}),
          newPassword,
        },
        user
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setExpanded(false);
      setSuccessMessage(
        res.linkedViaEmail
          ? 'Senha vinculada ao Firebase Auth. Agora você também pode entrar com e-mail e senha neste mesmo perfil.'
          : 'Senha atualizada com sucesso no Firebase Auth.'
      );
      await loadSecurity();
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const providerLabel =
    (security?.provider ?? user.provider) === 'google' ? 'Firebase Auth (Google)' : 'Firebase Auth (E-mail e senha)';

  return (
    <section className="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} strokeWidth={1.75} weight="regular" className="text-emerald-400" />
            Segurança da conta
          </h2>
          <p className="text-xs text-zinc-400">
            Provedor: <span className="text-zinc-200 font-medium">{providerLabel}</span>
            {security?.linkedViaEmail && (
              <span className="text-emerald-400"> · Login por e-mail vinculado</span>
            )}
          </p>
        </div>

        {(security?.canSetLocalPassword ?? Boolean(user.email)) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              setSuccessMessage(null);
              setExpanded((prev) => !prev);
            }}
            className="min-h-[38px] px-3.5 py-2 rounded-md bg-[#111113] hover:bg-zinc-800 border border-[#27272A] text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Key size={16} strokeWidth={1.75} weight="regular" className="text-orange-400" />
            {expanded
              ? 'Fechar'
              : security?.hasLocalPassword
                ? 'Alterar senha'
                : 'Definir senha'}
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/35 text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle size={16} strokeWidth={1.75} weight="regular" className="shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {expanded && (
        <form onSubmit={(e) => void handleSubmit(e)} className="pt-2 border-t border-[#27272A] space-y-3">
          {security?.provider === 'google' && !security.hasLocalPassword && (
            <p className="text-xs text-zinc-400 leading-relaxed">
              Vincule uma senha no Firebase Auth para também acessar este mesmo perfil usando e-mail e senha.
            </p>
          )}

          {requiresCurrentPassword && (
            <div className="space-y-1">
              <label htmlFor="account-current-password" className="block text-xs font-semibold text-zinc-300">
                Senha atual
              </label>
              <input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                className="w-full min-h-[40px] px-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="account-new-password" className="block text-xs font-semibold text-zinc-300">
                Nova senha
              </label>
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="w-full min-h-[40px] px-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="account-confirm-password" className="block text-xs font-semibold text-zinc-300">
                Confirmar nova senha
              </label>
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full min-h-[40px] px-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-3.5 py-2 rounded-md bg-[#111113] border border-[#27272A] text-xs font-semibold text-zinc-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-[#F97316] hover:bg-orange-400 disabled:opacity-50 text-xs font-semibold text-zinc-950 cursor-pointer"
            >
              {submitting ? 'Salvando...' : security?.hasLocalPassword ? 'Atualizar senha' : 'Vincular senha'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
