import { apiRequest } from './client';
import type { Transaction } from '../types/tutor';

const normalizeTransaction = (transaction: any): Transaction => ({
  id: transaction.id,
  type: transaction.type === 'credit' ? 'credit' : 'debit',
  amount: Math.abs(transaction.amount ?? transaction.amount_tokens ?? 0),
  description: transaction.description || transaction.reference || transaction.type || 'Wallet transaction',
  status: transaction.status || 'completed',
  createdAt: transaction.createdAt || transaction.created_at || '',
  sessionId: transaction.sessionId || transaction.session_id
});

export const walletApi = {
  async getWallet() {
    const response = await apiRequest<any>('/wallet', { method: 'GET' });
    const wallet = response.data || {};
    return {
      success: response.success,
      data: {
        ...wallet,
        balance: wallet.balance ?? wallet.balance_tokens ?? 0,
        transactions: (wallet.transactions || []).map(normalizeTransaction)
      }
    };
  },

  async purchaseTokens(amountKes: number, phoneNumber: string) {
    return apiRequest('/wallet/purchase', {
      method: 'POST',
      body: { amountKes, phoneNumber }
    });
  },

  async withdraw(amount: number, phoneNumber: string, payoutMethod = 'mpesa') {
    return apiRequest('/wallet/withdraw', {
      method: 'POST',
      body: { amount, phoneNumber, payoutMethod }
    });
  }
};
