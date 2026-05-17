import React from 'react';
import { AlertCircle, Info, X } from 'lucide-react';

interface CalloutBannerProps {
  type?: 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const styles = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

export const CalloutBanner: React.FC<CalloutBannerProps> = ({
  type = 'error',
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}) => {
  const Icon = type === 'info' ? Info : AlertCircle;
  return (
    <div className={`rounded-xl border p-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold">{title}</p>}
          <p className="text-sm leading-relaxed opacity-90">{message}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white"
            >
              {actionLabel}
            </button>
          )}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="rounded-lg p-1 hover:bg-white/50" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
