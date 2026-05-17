/* eslint-disable react-refresh/only-export-components */
// ─────────────────────────────────────────────────────────────────────────────
// src/shared/components/Toast.tsx  (FULL REPLACEMENT)
//
// Extends the original Toast with:
//   • 'pending' type  — amber spinner for in-flight payments
//   • 'warning' type  — amber warning icon
//   • 'info' type     — blue info icon
//   • useToast hook   — convenience hook
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertCircle, Info,
  Loader2, X,
} from 'lucide-react';
import type { ToastPayload, ToastType } from '../../types/wallet';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToastItem extends ToastPayload {
  id: string;
}

interface ToastContextValue {
  showToast: (payload: ToastPayload) => string;
  dismissToast: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Config per type ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ToastType,
  { bg: string; bar: string; Icon: React.FC<{ className?: string }>; iconColor: string; titleColor: string }
> = {
  success: {
    bg: 'bg-white',
    bar: 'bg-green-500',
    Icon: CheckCircle2,
    iconColor: 'text-green-500',
    titleColor: 'text-gray-900',
  },
  error: {
    bg: 'bg-white',
    bar: 'bg-red-500',
    Icon: XCircle,
    iconColor: 'text-red-500',
    titleColor: 'text-gray-900',
  },
  pending: {
    bg: 'bg-white',
    bar: 'bg-amber-400',
    Icon: Loader2,
    iconColor: 'text-amber-500 animate-spin',
    titleColor: 'text-gray-900',
  },
  warning: {
    bg: 'bg-white',
    bar: 'bg-amber-400',
    Icon: AlertCircle,
    iconColor: 'text-amber-500',
    titleColor: 'text-gray-900',
  },
  info: {
    bg: 'bg-white',
    bar: 'bg-blue-500',
    Icon: Info,
    iconColor: 'text-blue-500',
    titleColor: 'text-gray-900',
  },
};

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  error:   0,
  pending: 0,       // persistent until dismissed
  warning: 5000,
  info:    4000,
};

// ── Single toast item ─────────────────────────────────────────────────────────

const ToastItem: React.FC<{ toast: ToastItem; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  const cfg = TYPE_CONFIG[toast.type];
  const duration = toast.duration ?? DEFAULT_DURATION[toast.type];

  useEffect(() => {
    if (duration === 0) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <motion.div
      key={toast.id}
      layout
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={{   opacity: 0, y: -12, scale: 0.97  }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`relative flex items-start gap-3 ${cfg.bg} rounded-2xl shadow-2xl border border-gray-100 p-4 pr-10 w-full max-w-sm`}
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      {/* Left colour bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

      {/* Icon */}
      <cfg.Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${cfg.titleColor}`}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress bar (for non-persistent toasts) */}
      {duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${cfg.bar} origin-left rounded-b-2xl opacity-40`}
        />
      )}
    </motion.div>
  );
};

// ── Provider ──────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((payload: ToastPayload) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...payload, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem
                toast={toast}
                onClose={() => dismissToast(toast.id)}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export function usePaymentToasts() {
  const { showToast, dismissToast } = useToast();

  return {
    toastPending: (message?: string) =>
      showToast({
        type: 'pending',
        title: 'Processing payment…',
        message: message ?? 'Check your phone for the M-Pesa prompt.',
        duration: 0,
      }),
    toastSuccess: (tokens: number, receipt?: string) =>
      showToast({
        type: 'success',
        title: `+${tokens.toLocaleString()} tokens added!`,
        message: receipt ? `M-Pesa Receipt: ${receipt}` : 'Your wallet has been topped up.',
      }),
    toastFailed: (reason?: string) =>
      showToast({
        type: 'error',
        title: 'Payment not completed',
        message: reason ?? 'The payment was declined or cancelled. No money was deducted.',
      }),
    toastTimeout: () =>
      showToast({
        type: 'warning',
        title: 'Payment request expired',
        message: 'The STK Push timed out. If money was deducted, it will be refunded within 24 hours.',
      }),
    toastNetworkError: () =>
      showToast({
        type: 'error',
        title: 'Connection issue',
        message: 'Could not reach the server. Please check your internet and try again.',
      }),
    dismiss: dismissToast,
  };
}
