// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/utils/tokenPackages.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { TokenPackage } from '../../../types/wallet';

/** 1 KES = 0.5 tokens  →  1 token = 2 KES */
export const KES_PER_TOKEN = 2;

export function kesToTokens(kes: number): number {
  return Math.floor(kes / KES_PER_TOKEN);
}

export function tokensToKes(tokens: number): number {
  return tokens * KES_PER_TOKEN;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    label: 'Starter',
    amountKes: 100,
    tokens: 50,
  },
  {
    id: 'boost',
    label: 'Boost',
    amountKes: 300,
    tokens: 150,
    badge: 'Popular',
    badgeColor: 'indigo',
  },
  {
    id: 'power',
    label: 'Power',
    amountKes: 500,
    tokens: 250,
    badge: 'Best Value',
    badgeColor: 'green',
  },
  {
    id: 'pro',
    label: 'Pro',
    amountKes: 1000,
    tokens: 500,
  },
];

export const MIN_DEPOSIT_KES = 10;
export const MAX_DEPOSIT_KES = 70000;

/** Polling config */
export const POLL_INTERVAL_MS  = 2500;   // 2.5 s
export const POLL_TIMEOUT_MS   = 90000;  // 90 s — STK expires in ~75 s