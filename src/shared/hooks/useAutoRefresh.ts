import { useEffect, useRef } from 'react';

type AutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refreshOnFocus?: boolean;
  refreshOnReconnect?: boolean;
};

const DEFAULT_INTERVAL_MS = 30_000;

export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  {
    enabled = true,
    intervalMs = DEFAULT_INTERVAL_MS,
    refreshOnFocus = true,
    refreshOnReconnect = true,
  }: AutoRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async () => {
      if (cancelled || isRefreshingRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      isRefreshingRef.current = true;
      try {
        await refreshRef.current();
      } finally {
        isRefreshingRef.current = false;
      }
    };

    const interval = window.setInterval(run, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const handleFocus = () => { void run(); };
    const handleOnline = () => { void run(); };

    document.addEventListener('visibilitychange', handleVisibility);
    if (refreshOnFocus) window.addEventListener('focus', handleFocus);
    if (refreshOnReconnect) window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, intervalMs, refreshOnFocus, refreshOnReconnect]);
}
