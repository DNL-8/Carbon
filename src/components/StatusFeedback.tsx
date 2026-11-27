import type React from 'react';
import { Warning, X } from '@phosphor-icons/react';

export { SystemHudSkeleton } from './SystemHudSkeleton';

export const ErrorBanner: React.FC<{ message: string | null; onDismiss?: () => void }> = ({
  message,
  onDismiss,
}) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-red-950/35 border border-red-500/40 text-red-200 text-sm"
    >
      <div className="flex items-start gap-2.5">
        <Warning size={18} strokeWidth={1.75} weight="regular" className="text-red-400 shrink-0 mt-0.5" />
        <span className="leading-snug">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso de erro"
          className="text-red-300 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
        >
          <X size={18} strokeWidth={1.75} weight="regular" />
        </button>
      )}
    </div>
  );
};
