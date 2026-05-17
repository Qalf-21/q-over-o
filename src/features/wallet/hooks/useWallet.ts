// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/hooks/useWallet.ts
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { walletApi } from '../../../api/walletApi';
import type { UseWalletReturn, WalletData } from '../../../types/wallet';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export function useWallet(): UseWalletReturn {
  const [wallet,       setWallet]       = useState<WalletData | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else         setIsRefreshing(true);
    setError(null);

    try {
      const { data } = await walletApi.getWallet();
      if (mountedRef.current) setWallet(data);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Could not load wallet');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  useAutoRefresh(refresh, { intervalMs: 15_000 });

  return { wallet, isLoading, isRefreshing, error, refresh };
}
