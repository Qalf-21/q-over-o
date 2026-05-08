// src/shared/components/Toast.tsx
// Industry-standard toast notification. Slides in from top-right, auto-dismisses.
// Usage:
//   const [toast, setToast] = useState<ToastState | null>(null);
//   setToast({ type: 'success', title: 'Password updated', message: 'Your password was changed successfully.' });
//   <Toast toast={toast} onClose={() => setToast(null)} />

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastState {
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
  /** Auto-dismiss delay in ms. Default 4000. */
  duration?: number;
}

const CONFIGS = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    bg: 'bg-white',
    iconColor: 'text-emerald-500',
    titleColor: 'text-gray-900',
  },
  error: {
    icon: XCircle,
    bar: 'bg-red-500',
    bg: 'bg-white',
    iconColor: 'text-red-500',
    titleColor: 'text-gray-900',
  },
  warning: {
    icon: AlertCircle,
    bar: 'bg-amber-500',
    bg: 'bg-white',
    iconColor: 'text-amber-500',
    titleColor: 'text-gray-900',
  },
  info: {
    icon: Info,
    bar: 'bg-indigo-500',
    bg: 'bg-white',
    iconColor: 'text-indigo-500',
    titleColor: 'text-gray-900',
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [toast, onClose, duration]);

  const cfg = toast ? CONFIGS[toast.type] : null;

  return (
    <AnimatePresence>
      {toast && cfg && (
        <motion.div
          key={toast.title + toast.type}
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={`fixed top-5 right-5 z-[9999] flex items-start gap-3 ${cfg.bg} rounded-2xl shadow-2xl border border-gray-100 p-4 pr-10 max-w-sm w-full`}
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
        >
          {/* Left colour bar */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

          {/* Icon */}
          <cfg.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${cfg.titleColor}`}>{toast.title}</p>
            {toast.message && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{toast.message}</p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Progress bar */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`absolute bottom-0 left-0 right-0 h-0.5 ${cfg.bar} origin-left rounded-b-2xl opacity-40`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
