import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Wallet, ArrowUpRight, ArrowDownRight, History, CreditCard, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { TokenDisplay } from '../../dashboard/components/TokenDisplay';
import type { Transaction } from '../tutor';
import { walletApi } from '../../../api/walletApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';
import { WithdrawModal } from '../components/WithdrawalModal';
import { tokensToKes } from '../../wallet/utils/tokenPackages';

export const Earnings: React.FC = () => {
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingEscrow, setPendingEscrow] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const response = await walletApi.getWallet();
      setAvailableBalance(response.data.balance);
      setPendingEscrow(response.data.escrowIncoming || 0);
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  useAutoRefresh(() => loadEarnings(true), { intervalMs: 30_000 });

  const incomeTypes = new Set<Transaction['type']>(['credit', 'release']);
  const totalEarned = transactions
    .filter(transaction => incomeTypes.has(transaction.type) && transaction.status === 'completed')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const pendingBalance = pendingEscrow;

  const handleWithdraw = async (amountTokens: number, phoneNumber: string) => {
    await walletApi.withdraw(amountTokens, phoneNumber);
    await loadEarnings(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-gray-600 mt-1">Track your income and withdraw to M-Pesa</p>
        <Link
          to="/dashboard/reports/earnings"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <BarChart3 className="h-4 w-4" />
          Earnings Reports
        </Link>
      </div>

      {/* Balance Cards */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TokenDisplay 
          label="Available Balance"
          amount={availableBalance}
          variant="large"
        />
        
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">Pending (Escrow)</span>
            <History className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{pendingBalance.toLocaleString()}</div>
          <div className="text-sm text-gray-400 mt-1">tokens</div>
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Released after session completion
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">Total Earned</span>
            <Wallet className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalEarned.toLocaleString()}</div>
          <div className="text-sm text-gray-400 mt-1">tokens</div>
          <p className="text-xs text-green-600 mt-3">
            ≈ KES {tokensToKes(totalEarned).toLocaleString()} lifetime
          </p>
        </div>
      </div>

      {/* Withdraw Section */}
      <motion.div 
        initial={false}
        animate={{ height: showWithdrawForm ? 'auto' : 'auto' }}
        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">Withdraw to M-Pesa</h3>
            <p className="text-sm text-gray-500 mt-1">Minimum withdrawal: 100 tokens (KES 10)</p>
          </div>
          {!showWithdrawForm && (
            <button 
              onClick={() => setShowWithdrawForm(true)}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Withdraw
            </button>
          )}
        </div>

        <p className="border-t border-gray-100 pt-4 text-sm text-gray-500">
          100 tokens converts to KES 10. Withdrawals are paid through M-Pesa B2C.
        </p>
      </motion.div>

      {/* Transaction History */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Transaction History</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {transactions.map((transaction, index) => (
            <div 
              key={transaction.id}
              className={`flex items-center justify-between p-4 ${
                index !== transactions.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  incomeTypes.has(transaction.type) ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {incomeTypes.has(transaction.type) ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.createdAt).toLocaleDateString('en-KE')}
                    {' · '}
                    <span className={`capitalize ${
                      transaction.status === 'completed' ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {transaction.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className={`font-bold ${
                incomeTypes.has(transaction.type) ? 'text-green-600' : 'text-red-600'
              }`}>
                {incomeTypes.has(transaction.type) ? '+' : '-'}{transaction.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
      <WithdrawModal
        isOpen={showWithdrawForm}
        onClose={() => setShowWithdrawForm(false)}
        availableBalance={availableBalance}
        onWithdraw={handleWithdraw}
      />
    </div>
  );
};
