// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/components/TransactionHistory.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft, ArrowUpRight, Lock, Unlock,
  CreditCard, RefreshCw, History,
} from 'lucide-react';
import type { WalletTransaction } from '../../../types/wallet';

interface TransactionHistoryProps {
  transactions: WalletTransaction[];
  isLoading: boolean;
  limit?: number;
}

const TransactionIcon: React.FC<{ type: WalletTransaction['type']; status: string }> = ({
  type, status,
}) => {
  const iconMap: Record<string, React.ReactNode> = {
    deposit:    <ArrowDownLeft className="w-4 h-4" />,
    credit:     <ArrowDownLeft className="w-4 h-4" />,
    escrow:     <Lock className="w-4 h-4" />,
    release:    <Unlock className="w-4 h-4" />,
    withdrawal: <ArrowUpRight className="w-4 h-4" />,
    debit:      <ArrowUpRight className="w-4 h-4" />,
    refund:     <RefreshCw className="w-4 h-4" />,
  };

  const colorMap: Record<string, string> = {
    deposit:    'bg-green-100 text-green-600',
    credit:     'bg-green-100 text-green-600',
    escrow:     'bg-amber-100 text-amber-600',
    release:    'bg-blue-100 text-blue-600',
    withdrawal: 'bg-gray-100 text-gray-600',
    debit:      'bg-red-100 text-red-500',
    refund:     'bg-teal-100 text-teal-600',
  };

  const color = status === 'failed'
    ? 'bg-red-50 text-red-400'
    : colorMap[type] ?? 'bg-gray-100 text-gray-500';

  return (
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
      {iconMap[type] ?? <CreditCard className="w-4 h-4" />}
    </div>
  );
};

const amountSign = (type: WalletTransaction['type']): '+' | '-' | '' => {
  if (['deposit', 'credit', 'release', 'refund'].includes(type)) return '+';
  if (['escrow', 'withdrawal', 'debit'].includes(type)) return '-';
  return '';
};

const amountColor = (type: WalletTransaction['type'], status: string): string => {
  if (status === 'failed') return 'text-gray-400';
  if (['deposit', 'credit', 'release', 'refund'].includes(type)) return 'text-green-600';
  return 'text-gray-700';
};

const statusBadge = (status: WalletTransaction['status']): React.ReactNode => {
  const config = {
    pending:   { text: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
    completed: null,
    failed:    { text: 'Failed',    cls: 'bg-red-100 text-red-600'    },
  }[status];

  if (!config) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.cls}`}>
      {config.text}
    </span>
  );
};

const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0 animate-pulse">
    <div className="w-10 h-10 rounded-2xl bg-gray-200 flex-shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-gray-200 rounded w-36" />
      <div className="h-2.5 bg-gray-100 rounded w-24" />
    </div>
    <div className="h-4 bg-gray-200 rounded w-16" />
  </div>
);

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isLoading,
  limit,
}) => {
  const visible = limit ? transactions.slice(0, limit) : transactions;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" />
          <h3 className="font-bold text-gray-900 text-sm">Transaction History</h3>
        </div>
        {transactions.length > 0 && (
          <span className="text-xs text-gray-400">{transactions.length} transactions</span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <History className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No transactions yet</p>
          <p className="text-xs text-gray-400 mt-1">Your payment history will appear here</p>
        </div>
      ) : (
        visible.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
          >
            <TransactionIcon type={tx.type} status={tx.status} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {tx.description}
                </p>
                {statusBadge(tx.status)}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(tx.createdAt).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
                {tx.mpesaReceipt && (
                  <span className="ml-2 font-mono text-gray-300">{tx.mpesaReceipt}</span>
                )}
              </p>
            </div>

            <div
              className={`text-sm font-bold flex-shrink-0 ${amountColor(tx.type, tx.status)}`}
            >
              {amountSign(tx.type)}{tx.amount.toLocaleString()}
              <span className="text-xs font-normal text-gray-400 ml-0.5">tkn</span>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};
