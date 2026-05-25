// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/hooks/usePaymentPolling.ts
//
// Polls the backend payment status endpoint every 4 seconds until Safaricom's
// callback has moved the payment intent to a terminal state, or the local
// 60-second timeout fires.
//
// Rules:
//   • Never trusts a "success" from local state — always waits for backend
//   • Stops polling safely on unmount
//   • Handles stale responses (ignores results after stopPolling() called)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { walletApi } from '../../../api/walletApi';
import type { PaymentIntentStatus, UsePaymentPollingReturn } from '../../../types/wallet';
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from '../utils/tokenPackages';

const TERMINAL: Set<PaymentIntentStatus> = new Set([
  'completed', 'failed', 'cancelled', 'timeout',
]);

export function usePaymentPolling(
  checkoutRequestId: string | null,
  onComplete?: (status: PaymentIntentStatus, tokensAdded?: number) => void,
): UsePaymentPollingReturn {
  const [status,     setStatus]     = useState<PaymentIntentStatus | null>(null);
  const [receipt,    setReceipt]    = useState<string | null>(null);
  const [tokensAdded, setTokensAdded] = useState<number | null>(null);
  const [isPolling,  setIsPolling]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Internal refs so the interval callback doesn't close over stale state
  const activeRef    = useRef(false);   // false = stop polling
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const requestRef   = useRef(false);
  const completedRef = useRef(false);

  const stopPolling = useCallback(() => {
    activeRef.current = false;
    requestRef.current = false;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!checkoutRequestId) return;

    activeRef.current = true;
    completedRef.current = false;
    void Promise.resolve().then(() => {
      if (!activeRef.current) return;
      setIsPolling(true);
      setStatus('pending');
      setReceipt(null);
      setTokensAdded(null);
      setError(null);
    });

    const poll = async () => {
      if (!activeRef.current || requestRef.current || completedRef.current) return;

      try {
        requestRef.current = true;
        const { data } = await walletApi.getPaymentStatusByCheckoutRequestId(checkoutRequestId);
        if (!activeRef.current) return; // stale — ignore

        const newStatus = data.status;
        setStatus(newStatus);

        if (newStatus === 'completed') {
          setReceipt(data.mpesaReceiptNumber ?? null);
          setTokensAdded(data.tokensExpected ?? null);
        }

        if (TERMINAL.has(newStatus)) {
          completedRef.current = true;
          stopPolling();
          onComplete?.(newStatus, newStatus === 'completed' ? data.tokensExpected : undefined);
        }
      } catch {
        // Network hiccup — keep polling; timeout will eventually stop it.
        if (!activeRef.current) return;
        setError('Still waiting for payment confirmation. Retrying...');
      } finally {
        requestRef.current = false;
      }
    };

    // Poll immediately, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Hard timeout: mark as timed out if no terminal state within window
    timeoutRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      completedRef.current = true;
      setStatus('timeout');
      setError(null);
      stopPolling();
      onComplete?.('timeout');
    }, POLL_TIMEOUT_MS);

    return () => stopPolling();
  }, [checkoutRequestId, onComplete, stopPolling]);

  return { status, receipt, tokensAdded, isPolling, error, stopPolling };
}
