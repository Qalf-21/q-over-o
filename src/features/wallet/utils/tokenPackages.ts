// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/utils/tokenPackages.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { TokenPackage } from '../../../types/wallet';

/** 1 KES = 10 tokens. */
export const TOKENS_PER_KES = 10;

export function kesToTokens(kes: number): number {
  return Math.floor(kes * TOKENS_PER_KES);
}

export function tokensToKes(tokens: number): number {
  return tokens / TOKENS_PER_KES;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    label: 'Starter',
    amountKes: 100,
    tokens: 1000,
  },
  {
    id: 'boost',
    label: 'Boost',
    amountKes: 300,
    tokens: 3000,
    badge: 'Popular',
    badgeColor: 'indigo',
  },
  {
    id: 'power',
    label: 'Power',
    amountKes: 500,
    tokens: 5000,
    badge: 'Best Value',
    badgeColor: 'green',
  },
  {
    id: 'pro',
    label: 'Pro',
    amountKes: 1000,
    tokens: 10000,
  },
];

export const MIN_DEPOSIT_KES = 1;
export const MAX_DEPOSIT_KES = 70000;

/** Polling config */
export const POLL_INTERVAL_MS  = 2500;   // 2.5 s
export const POLL_TIMEOUT_MS   = 90000;  // 90 s — STK expires in ~75 s
