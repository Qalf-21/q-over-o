// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/components/DepositModal.tsx
//
// Premium fintech-grade M-Pesa deposit modal for Q-over-o.
// Covers the full STK Push UX:
//   form → confirm → pending → success | failed | timeout
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
  TOKEN_PACKAGES, kesToTokens, MIN_DEPOSIT_KES, MAX_DEPOSIT_KES,
} from '../utils/tokenPackages';
import type { TokenPackage } from '../../../types/wallet';

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

// ── Package chip ──────────────────────────────────────────────────────────────

const PackageChip: React.FC<{
  pkg: TokenPackage;
  selected: boolean;
  onClick: () => void;
}> = ({ pkg, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
      selected
        ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
    }`}
  >
    {pkg.badge && (
      <span
        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${
          pkg.badgeColor === 'green'
            ? 'bg-green-500 text-white'
            : 'bg-indigo-600 text-white'
        }`}
      >
        {pkg.badge}
      </span>
    )}
    <span className={`text-base font-bold ${selected ? 'text-indigo-700' : 'text-gray-900'}`}>
      KES {pkg.amountKes.toLocaleString()}
    </span>
    <span className={`text-xs mt-0.5 ${selected ? 'text-indigo-500' : 'text-gray-500'}`}>
      {pkg.tokens} tokens
    </span>
  </button>
);

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
  const [selectedPkg,  setSelectedPkg]  = useState<TokenPackage | null>(null);

  const {
    step, amountKes, phone, paymentIntentId,
    tokensToReceive, isSubmitting, error,
    setAmountKes, setPhone, initiateDeposit,
    handlePollComplete, reset,
  } = useDeposit(onDepositSuccess) as ReturnType<typeof useDeposit> & {
    handlePollComplete: (status: string, tokens?: number) => void;
  };

  // ── Polling ───────────────────────────────────────────────────────────────
  const { status: pollStatus, receipt, tokensAdded } = usePaymentPolling(
    step === 'pending' ? paymentIntentId : null,
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

  const handlePackageSelect = useCallback((pkg: TokenPackage) => {
    setSelectedPkg(pkg);
    setCustomAmount('');
    setAmountKes(pkg.amountKes);
  }, [setAmountKes]);

  const handleCustomAmount = useCallback((val: string) => {
    setCustomAmount(val);
    setSelectedPkg(null);
    const n = parseInt(val, 10);
    setAmountKes(isNaN(n) ? 0 : n);
  }, [setAmountKes]);

  const handleClose = useCallback(() => {
    reset();
    setPhoneDisplay('');
    setPhoneError(null);
    setCustomAmount('');
    setSelectedPkg(null);
    onClose();
  }, [reset, onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      reset();
      setPhoneDisplay('');
      setPhoneError(null);
      setCustomAmount('');
      setSelectedPkg(null);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step: FORM ─────────────────────────────────────────────────────────────
  const renderForm = () => (
    <div className="space-y-6">
      {/* Token packages */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Quick Select
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TOKEN_PACKAGES.map((pkg) => (
            <PackageChip
              key={pkg.id}
              pkg={pkg}
              selected={selectedPkg?.id === pkg.id}
              onClick={() => handlePackageSelect(pkg)}
            />
          ))}
        </div>
      </div>

      {/* Custom amount */}
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
            placeholder="Enter amount"
            className="w-full pl-14 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl text-gray-900 font-semibold text-lg placeholder:text-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
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
      </div>

      {/* Phone number */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          M-Pesa Number
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span className="text-lg">🇰🇪</span>
            <span className="text-sm font-semibold text-gray-500">+254</span>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={phoneDisplay}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="07XX XXX XXX"
            className={`w-full pl-[4.5rem] pr-4 py-3.5 border-2 rounded-2xl text-gray-900 font-medium placeholder:text-gray-300 focus:ring-4 outline-none transition-all ${
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
          className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100"
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
            Secured via Safaricom M-Pesa STK Push
          </div>
        </motion.div>
      )}

      {/* Global error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700">
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => canProceed && initiateDeposit()}
        disabled={!canProceed || isSubmitting}
        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
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
          This prompt expires in about 75 seconds
        </p>
      </div>

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

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 text-left space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tokens added</span>
          <span className="font-bold text-green-700 text-base">
            +{(effectiveTokens || 0).toLocaleString()} tokens
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Amount paid</span>
          <span className="font-semibold text-gray-800">
            KES {amountKes.toLocaleString()}
          </span>
        </div>
        {receipt && (
          <div className="flex justify-between text-sm pt-2 border-t border-green-100">
            <span className="text-gray-500">M-Pesa Receipt</span>
            <span className="font-mono text-xs text-gray-700">{receipt}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all"
      >
        Done
      </button>
    </div>
  );

  // ── Step: FAILED ───────────────────────────────────────────────────────────
  const renderFailed = () => (
    <div className="text-center py-6 space-y-5">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto"
      >
        <XCircle className="w-12 h-12 text-red-500" />
      </motion.div>

      <div>
        <h3 className="text-xl font-bold text-gray-900">Payment Not Completed</h3>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          The payment was{' '}
          {pollStatus === 'cancelled' ? 'cancelled' : 'declined'}.
          {' '}No money has been deducted from your M-Pesa.
        </p>
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700 text-left">
        Common reasons: wrong PIN, insufficient M-Pesa balance, or request timed out.
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setPhoneDisplay('');
            setPhoneError(null);
            setCustomAmount('');
            setSelectedPkg(null);
          }}
          className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
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
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          We didn't receive confirmation from M-Pesa. If money was deducted,
          it will be refunded automatically within 24 hours.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 text-left">
        <p className="font-semibold mb-1">What happened?</p>
        <p>The STK Push may have expired before you entered your PIN, or there was a network delay.</p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setPhoneDisplay('');
            setPhoneError(null);
            setCustomAmount('');
            setSelectedPkg(null);
          }}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    </div>
  );

  // ── Step content router ────────────────────────────────────────────────────
  const stepContent = () => {
    switch (step) {
      case 'form':    return renderForm();
      case 'pending': return renderPending();
      case 'success': return renderSuccess();
      case 'failed':  return renderFailed();
      case 'timeout': return renderTimeout();
      default:        return renderForm();
    }
  };

  const stepLabel: Record<string, string> = {
    form:    'Top Up Wallet',
    confirm: 'Confirm Payment',
    pending: 'Processing Payment',
    success: 'Payment Complete',
    failed:  'Payment Failed',
    timeout: 'Payment Timed Out',
  };

  // ── Prevent close during pending ─────────────────────────────────────────
  const safeClose = () => {
    if (step === 'pending') return; // don't allow close while STK is live
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={safeClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0,  opacity: 1, scale: 1 }}
            exit={{   y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white z-10 px-6 pt-4 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(step === 'form') && (
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                )}
                <h2 className="text-lg font-bold text-gray-900">
                  {stepLabel[step] || 'Top Up Wallet'}
                </h2>
              </div>
              <button
                type="button"
                onClick={safeClose}
                disabled={step === 'pending'}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Step progress dots */}
            {(step === 'form' || step === 'pending') && (
              <div className="flex items-center gap-2 px-6 pt-3">
                {['form', 'pending'].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      s === step ? 'bg-indigo-600' : step === 'pending' ? 'bg-indigo-200' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Body */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{   opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                >
                  {stepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* M-Pesa trust badge */}
            {step === 'form' && (
              <div className="px-6 pb-5">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5" />
                  Payments secured by Safaricom M-Pesa
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
