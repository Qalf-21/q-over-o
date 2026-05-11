// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/hooks/useDeposit.ts
//
// Orchestrates the full STK Push deposit flow:
//   form → confirm → initiateDeposit → pending (polling) → success | failed | timeout
//
// Security rules enforced:
//   • NEVER updates wallet balance locally
//   • NEVER trusts a "success" until backend confirms
//   • Prevents duplicate submissions via isSubmitting guard
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import { walletApi } from '../../../api/walletApi';
import { validatePhone, stripPhoneFormat } from '../utils/phoneUtils';
import { kesToTokens, MIN_DEPOSIT_KES, MAX_DEPOSIT_KES } from '../utils/tokenPackages';
import type { DepositStep, UseDepositReturn } from '../../../types/wallet';

export function useDeposit(
  onSuccess?: (tokensAdded: number) => void,
): UseDepositReturn {
  const [step,            setStep]            = useState<DepositStep>('form');
  const [amountKes,       setAmountKes]       = useState(0);
  const [phone,           setPhone]           = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Guard against duplicate submissions
  const submittingRef = useRef(false);

  const tokensToReceive = kesToTokens(amountKes);

  const reset = useCallback(() => {
    setStep('form');
    setAmountKes(0);
    setPhone('');
    setPaymentIntentId(null);
    setIsSubmitting(false);
    setError(null);
    submittingRef.current = false;
  }, []);

  const initiateDeposit = useCallback(async () => {
    if (submittingRef.current) return; // prevent double-tap

    // ── Client-side validation ────────────────────────────────────────────
    if (amountKes < MIN_DEPOSIT_KES || amountKes > MAX_DEPOSIT_KES) {
      setError(`Amount must be between KES ${MIN_DEPOSIT_KES} and ${MAX_DEPOSIT_KES.toLocaleString()}`);
      return;
    }

    const raw = stripPhoneFormat(phone);
    const phoneResult = validatePhone(raw);
    if (!phoneResult.valid) {
      setError(phoneResult.error);
      return;
    }

    // ── Initiate STK Push ─────────────────────────────────────────────────
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const { data } = await walletApi.initiateDeposit(amountKes, raw);
      setPaymentIntentId(data.paymentIntentId);
      setStep('pending');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment initiation failed. Please try again.';
      setError(msg);
      setStep('form');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [amountKes, phone]);

  // Called by the polling hook when a terminal status is reached
  const handlePollComplete = useCallback(
    (status: string, tokensAdded?: number) => {
      if (status === 'completed') {
        setStep('success');
        if (tokensAdded) onSuccess?.(tokensAdded);
      } else if (status === 'timeout') {
        setStep('timeout');
      } else {
        setStep('failed');
      }
    },
    [onSuccess],
  );

  return {
    step,
    amountKes,
    phone,
    paymentIntentId,
    tokensToReceive,
    isSubmitting,
    error,
    setAmountKes,
    setPhone,
    initiateDeposit,
    handlePollComplete,
    reset,
  } as UseDepositReturn & { handlePollComplete: typeof handlePollComplete };
}