// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/pages/WalletPage.tsx
//
// Main wallet dashboard page for tutees.
// Integrates: balance card, deposit modal, transaction history, escrow info.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Lock, TrendingDown } from 'lucide-react';
import { WalletBalanceCard } from '../components/WalletBalanceCard';
import { DepositModal } from '../components/DepositModal';
import { TransactionHistory } from '../components/TransactionHistory';
import { useWallet } from '../hooks/useWallet';
import { tokensToKes } from '../utils/tokenPackages';

export const WalletPage: React.FC = () => {
  const { wallet, isLoading, isRefreshing, error, refresh } = useWallet();
  const [showDeposit, setShowDeposit] = useState(false);

  const handleDepositSuccess = useCallback(
    async (_tokensAdded: number) => {
      // Wallet balance is NOT updated locally.
      // We refresh from backend to reflect verified state.
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Wallet</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your tokens and payment history
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Balance card */}
      <WalletBalanceCard
        wallet={wallet}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onDeposit={() => setShowDeposit(true)}
        onRefresh={refresh}
      />

      {/* Info cards */}
      {!isLoading && wallet && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {/* Escrow */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                In Escrow
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {wallet.escrowBalance.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              tokens • ≈ KES {tokensToKes(wallet.escrowBalance).toLocaleString()}
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Released after sessions complete
            </p>
          </div>

          {/* Total spent */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Spent
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {wallet.totalSpent.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              tokens all time
            </p>
          </div>
        </motion.div>
      )}

      {/* Transaction history */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <TransactionHistory
          transactions={wallet?.transactions ?? []}
          isLoading={isLoading}
        />
      </motion.div>

      {/* Deposit modal */}
      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        onDepositSuccess={handleDepositSuccess}
      />
    </div>
  );
};
