// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/components/DepositModal.tsx
//
// Changes:
//   • Removed "Quick Select" token packages section
//   • Removed +254 prefix from phone input; now a plain input with
//     placeholder "01xxxxxxxx / 07xxxxxxxx"
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Smartphone, Wallet, CheckCircle2, XCircle,
  Clock,  Loader2, AlertCircle, RefreshCw,
  Zap, Shield,
} from 'lucide-react';
import { useDeposit } from '../hooks/useDeposit';
import { usePaymentPolling } from '../hooks/usePaymentPolling';
import { validatePhone, formatPhoneInput, stripPhoneFormat } from '../utils/phoneUtils';
import {
  kesToTokens, MIN_DEPOSIT_KES, MAX_DEPOSIT_KES,
} from '../utils/tokenPackages';

// ── Sub-component types ───────────────────────────────────────────────────────

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful deposit so the parent can refresh wallet */
  onDepositSuccess?: (tokensAdded: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const maskPhone = (phone: string): string => {
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return phone;
  return `${d.slice(0, 4)} *** ***`;
};

// ── Pending pulse animation ───────────────────────────────────────────────────

const PendingPulse: React.FC = () => (
  <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-green-400"
        initial={{ scale: 0.6, opacity: 0.8 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: i * 0.5,
          ease: 'easeOut',
        }}
      />
    ))}
    <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
      <Smartphone className="w-9 h-9 text-white" />
    </div>
  </div>
);

// ── Main Modal ────────────────────────────────────────────────────────────────

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onDepositSuccess,
}) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [phoneError,   setPhoneError]   = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const {
    step, amountKes, phone, checkoutRequestId,
    tokensToReceive, isSubmitting, error,
    setAmountKes, setPhone, initiateDeposit,
    handlePollComplete, reset,
  } = useDeposit(onDepositSuccess) as ReturnType<typeof useDeposit> & {
    handlePollComplete: (status: string, tokens?: number) => void;
  };

  // ── Polling ───────────────────────────────────────────────────────────────
  const { receipt, tokensAdded, error: pollingError } = usePaymentPolling(
    step === 'pending' ? checkoutRequestId : null,
    handlePollComplete,
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const effectiveTokens = tokensAdded ?? tokensToReceive;
  const canProceed =
    amountKes >= MIN_DEPOSIT_KES &&
    amountKes <= MAX_DEPOSIT_KES &&
    phoneError === null &&
    phone.length > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePhoneChange = useCallback((val: string) => {
    const formatted = formatPhoneInput(val);
    setPhoneDisplay(formatted);
    const raw = stripPhoneFormat(formatted);
    setPhone(raw);
    if (raw.length >= 10) {
      const result = validatePhone(raw);
      setPhoneError(result.valid ? null : result.error);
    } else {
      setPhoneError(null);
    }
  }, [setPhone]);

  const handleCustomAmount = useCallback((val: string) => {
    setCustomAmount(val);
    const n = parseInt(val, 10);
    setAmountKes(isNaN(n) ? 0 : n);
  }, [setAmountKes]);

  const handleClose = useCallback(() => {
    reset();
    setPhoneDisplay('');
    setPhoneError(null);
    setCustomAmount('');
    onClose();
  }, [reset, onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(() => {
        reset();
        setPhoneDisplay('');
        setPhoneError(null);
        setCustomAmount('');
      });
    }
  }, [isOpen, reset]);

  // ── Step: FORM ─────────────────────────────────────────────────────────────
  const renderForm = () => (
    <div className="space-y-6">
      {/* Amount input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Amount (KES)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
            KES
          </span>
          <input
            type="number"
            min={MIN_DEPOSIT_KES}
            max={MAX_DEPOSIT_KES}
            value={customAmount || (amountKes > 0 ? String(amountKes) : '')}
            onChange={(e) => handleCustomAmount(e.target.value)}
            placeholder="KES 50 = 500 tokens"
            className="app-input py-3.5 pl-14 pr-4 text-lg font-semibold placeholder:text-slate-300"
          />
          {amountKes > 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-indigo-600">
                {kesToTokens(amountKes).toLocaleString()} tokens
              </span>
            </div>
          )}
        </div>
        {amountKes > 0 && amountKes < MIN_DEPOSIT_KES && (
          <p className="text-xs text-red-500 mt-1">Minimum deposit is KES {MIN_DEPOSIT_KES}</p>
        )}
        <p className="text-xs text-gray-400 mt-1.5">1 KES = 10 tokens. Minimum top-up is KES 1.</p>
      </div>

      {/* Phone number — no +254 prefix, plain input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          M-Pesa Number
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg select-none">🇰🇪</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={phoneDisplay}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="01xxxxxxxx / 07xxxxxxxx"
            className={`w-full rounded-xl border bg-white py-3.5 pl-10 pr-10 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:ring-2 ${
              phoneError
                ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10'
                : phone && !phoneError
                ? 'border-green-400 focus:border-green-400 focus:ring-green-400/10'
                : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/10'
            }`}
          />
          {phone && !phoneError && (
            <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
        </div>
        {phoneError ? (
          <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {phoneError}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1.5">
            Supports 07XX, 01XX, +254… formats
          </p>
        )}
      </div>

      {/* Summary card */}
      {amountKes >= MIN_DEPOSIT_KES && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-soft-panel p-4"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">You pay</span>
            <span className="font-bold text-gray-900">KES {amountKes.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1.5">
            <span className="text-gray-600">You receive</span>
            <span className="font-bold text-indigo-700">
              {kesToTokens(amountKes).toLocaleString()} tokens
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center gap-1.5 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            KES {amountKes.toLocaleString()} = {kesToTokens(amountKes).toLocaleString()} tokens via M-Pesa STK Push
          </div>
        </motion.div>
      )}

      {/* Global error */}
      {error && (
        <div className="app-alert-error p-3.5">
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => canProceed && initiateDeposit()}
        disabled={!canProceed || isSubmitting}
        className="app-button-primary w-full py-4 text-base font-bold disabled:scale-100 disabled:shadow-none"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sending to your phone…
          </>
        ) : (
          <>
            <Smartphone className="w-5 h-5" />
            Pay with M-Pesa
          </>
        )}
      </button>
    </div>
  );

  // ── Step: PENDING ──────────────────────────────────────────────────────────
  const renderPending = () => (
    <div className="text-center py-4 space-y-6">
      <PendingPulse />

      <div>
        <h3 className="text-xl font-bold text-gray-900">Check your phone</h3>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          A payment prompt has been sent to{' '}
          <span className="font-semibold text-gray-800">{maskPhone(phoneDisplay)}</span>.
          Enter your M-Pesa PIN to complete the payment.
        </p>
      </div>

      {/* Live status indicator */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-amber-800 font-medium">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-4 h-4" />
          </motion.div>
          Waiting for confirmation…
        </div>
        <p className="text-xs text-amber-600 mt-1.5 text-center">
          This request will time out after 60 seconds if no confirmation arrives
        </p>
      </div>

      {pollingError && (
        <div className="app-alert-error p-3.5 text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{pollingError}</span>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>Do NOT close this window while payment is processing.</p>
        <p>Your balance will update automatically once confirmed.</p>
      </div>
    </div>
  );

  // ── Step: SUCCESS ──────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <div className="text-center py-6 space-y-5">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-200"
      >
        <CheckCircle2 className="w-12 h-12 text-white" />
      </motion.div>

      <div>
        <h3 className="text-2xl font-bold text-gray-900">Payment Received!</h3>
        <p className="text-gray-500 text-sm mt-2">
          Your wallet has been topped up.
        </p>
      </div>

      {effectiveTokens > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
          <div className="flex items-center justify-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-500" />
            <span className="text-2xl font-bold text-indigo-700">
              +{effectiveTokens.toLocaleString()} tokens
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">added to your wallet</p>
          {receipt && (
            <p className="text-xs text-gray-400 mt-2">Receipt: {receipt}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleClose}
        className="app-button-primary w-full py-3.5 font-bold"
      >
        Done
      </button>
    </div>
  );

  // ── Step: FAILED ───────────────────────────────────────────────────────────
  const renderFailed = () => (
    <div className="text-center py-6 space-y-5">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <XCircle className="w-12 h-12 text-red-500" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">Payment Failed</h3>
        <p className="text-gray-500 text-sm mt-2">
          The payment was not completed. You have not been charged.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="app-button-secondary flex-1 py-3"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { reset(); setCustomAmount(''); setPhoneDisplay(''); setPhoneError(null); }}
          className="app-button-primary flex-1 py-3"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );

  // ── Step: TIMEOUT ──────────────────────────────────────────────────────────
  const renderTimeout = () => (
    <div className="text-center py-6 space-y-5">
      <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
        <Clock className="w-12 h-12 text-amber-500" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">Request Timed Out</h3>
        <p className="text-gray-500 text-sm mt-2">
          We did not receive payment confirmation within 60 seconds. If you completed the PIN prompt, refresh your wallet before trying again.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="app-button-secondary flex-1 py-3"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { reset(); setCustomAmount(''); setPhoneDisplay(''); setPhoneError(null); }}
          className="app-button-primary flex-1 py-3"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={step === 'form' ? handleClose : undefined}
          />

          {/* Modal — outer div handles centering; Framer Motion div handles animation */}
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
          <motion.div
            key="modal"
            className="w-full max-w-md pointer-events-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="app-modal-panel">
              <div className="app-modal-accent" />
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Top Up Wallet</h2>
                </div>
                {step !== 'pending' && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                )}
              </div>

              {/* Progress indicator */}
              <div className="h-0.5 bg-gray-100">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                  animate={{
                    width: step === 'form' ? '33%' : step === 'pending' ? '66%' : '100%',
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step === 'form'    && renderForm()}
                    {step === 'pending' && renderPending()}
                    {step === 'success' && renderSuccess()}
                    {step === 'failed'  && renderFailed()}
                    {step === 'timeout' && renderTimeout()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer trust badge */}
              {step === 'form' && (
                <div className="px-6 pb-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5" />
                  Payments secured by Safaricom M-Pesa
                </div>
              )}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
