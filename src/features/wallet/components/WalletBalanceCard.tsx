// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/components/WalletBalanceCard.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Lock, TrendingUp, RefreshCw, Plus } from 'lucide-react';
import type { WalletData } from '../../../types/wallet';
import { tokensToKes } from '../utils/tokenPackages';

interface WalletBalanceCardProps {
  wallet: WalletData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onDeposit: () => void;
  onRefresh: () => void;
}

const SkeletonBar = ({ w }: { w: string }) => (
  <div className={`h-3 bg-gray-200 rounded-full animate-pulse ${w}`} />
);

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  wallet,
  isLoading,
  isRefreshing,
  onDeposit,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white space-y-4">
        <SkeletonBar w="w-24 opacity-40" />
        <SkeletonBar w="w-40 opacity-60 h-8" />
        <div className="flex gap-3">
          <SkeletonBar w="w-20 opacity-30" />
          <SkeletonBar w="w-20 opacity-30" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
      <div className="absolute -bottom-12 -left-6 w-48 h-48 bg-white/5 rounded-full" />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-indigo-200 text-sm font-medium">Available Balance</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Refresh balance"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-300 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Balance */}
        <div className="mb-5">
          <div className="text-4xl font-bold tracking-tight">
            {(wallet?.balance ?? 0).toLocaleString()}
            <span className="text-xl text-indigo-300 ml-2">tokens</span>
          </div>
          <div className="text-indigo-300 text-sm mt-1">
            ≈ KES {tokensToKes(wallet?.balance ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Secondary stats */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-300" />
            <div>
              <p className="text-[11px] text-indigo-300 leading-none">In Escrow</p>
              <p className="text-sm font-semibold mt-0.5">
                {(wallet?.escrowBalance ?? 0).toLocaleString()} tkn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-300" />
            <div>
              <p className="text-[11px] text-indigo-300 leading-none">Total Spent</p>
              <p className="text-sm font-semibold mt-0.5">
                {(wallet?.totalSpent ?? 0).toLocaleString()} tkn
              </p>
            </div>
          </div>
        </div>

        {/* Add tokens CTA */}
        <button
          type="button"
          onClick={onDeposit}
          className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-5 py-2.5 rounded-2xl text-sm hover:bg-indigo-50 active:scale-95 transition-all shadow-lg shadow-indigo-900/20"
        >
          <Plus className="w-4 h-4" />
          Add Tokens
        </button>
      </div>
    </motion.div>
  );
};
