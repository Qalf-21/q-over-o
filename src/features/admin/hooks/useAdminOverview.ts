// src/features/admin/hooks/useAdminOverview.ts
//
// Fetches the full admin overview and derives chart-friendly daily-bucketed data.
// All processing happens client-side so the backend payload stays lean.

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../api/adminApi';
import type { AdminFullOverview, PaymentChartDataPoint, UserGrowthDataPoint } from '../types/admin';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

// ── Chart bucket helpers ──────────────────────────────────────────────────────

function toYMD(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function last30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export interface DailyPoint {
  date: string;      // "YYYY-MM-DD"
  label: string;     // "May 1"
  value: number;
  secondary?: number; // tokens, where relevant
}

function buildDailyPoints(
  items: Array<{ created_at: string }>,
  getValue: (items: Array<{ created_at: string }>) => number,
  getSecondary?: (items: Array<{ created_at: string }>) => number,
): DailyPoint[] {
  const days = last30Days();
  const byDay = new Map<string, Array<{ created_at: string }>>();
  days.forEach((d) => byDay.set(d, []));
  items.forEach((item) => {
    const day = toYMD(item.created_at);
    if (byDay.has(day)) byDay.get(day)!.push(item);
  });
  return days.map((day) => {
    const pts = byDay.get(day)!;
    const d = new Date(day + 'T00:00:00Z');
    return {
      date: day,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: getValue(pts),
      secondary: getSecondary ? getSecondary(pts) : undefined,
    };
  });
}

// ── Public hook ───────────────────────────────────────────────────────────────

export interface AdminOverviewState {
  data: AdminFullOverview | null;
  isLoading: boolean;
  error: string | null;
  // Derived daily chart series
  sessionChart: DailyPoint[];
  revenueChart: DailyPoint[];
  userGrowthChart: DailyPoint[];
  tutorGrowthChart: DailyPoint[];
  tokenPurchaseChart: DailyPoint[];
  // Refresh trigger
  refresh: () => void;
}

export function useAdminOverview(): AdminOverviewState {
  const [data, setData] = useState<AdminFullOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      setData(await adminApi.getAdminFullOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useAutoRefresh(() => loadOverview(true), { intervalMs: 30_000 });

  // ── Derived chart series (memoised implicitly via data reference) ────────────
  const charts = data?.charts;

  const sessionChart: DailyPoint[] = charts
    ? buildDailyPoints(
        charts.sessionsTimeline,
        (pts) => pts.length,
      )
    : [];

  const revenueChart: DailyPoint[] = charts
    ? buildDailyPoints(
        charts.revenueTimeline,
        (pts) => (pts as PaymentChartDataPoint[]).reduce((s, p) => s + (p.amount_kes || 0), 0),
        (pts) => (pts as PaymentChartDataPoint[]).reduce((s, p) => s + (p.tokens_expected || 0), 0),
      )
    : [];

  const userGrowthChart: DailyPoint[] = charts
    ? buildDailyPoints(
        charts.userGrowth,
        (pts) => pts.length,
        (pts) => (pts as UserGrowthDataPoint[]).filter((p) => p.role === 'tutor').length,
      )
    : [];

  const tutorGrowthChart: DailyPoint[] = charts
    ? buildDailyPoints(
        charts.userGrowth,
        (pts) => (pts as UserGrowthDataPoint[]).filter((p) => p.role === 'tutor').length,
      )
    : [];

  const tokenPurchaseChart: DailyPoint[] = charts
    ? buildDailyPoints(
        charts.tokenPurchases,
        (pts) => (pts as PaymentChartDataPoint[]).reduce((s, p) => s + (p.tokens_expected || 0), 0),
        (pts) => (pts as PaymentChartDataPoint[]).reduce((s, p) => s + (p.amount_kes || 0), 0),
      )
    : [];

  return {
    data,
    isLoading,
    error,
    sessionChart,
    revenueChart,
    userGrowthChart,
    tutorGrowthChart,
    tokenPurchaseChart,
    refresh,
  };
}
