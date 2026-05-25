import { sessionApi } from '../../api/sessionApi';
import { walletApi } from '../../api/walletApi';
import type { Earnings, Session, Transaction } from './tutor';

class TutorService {
  getSessions(): Promise<{ success: boolean; data: Session[] }> {
    return sessionApi.getTutorSessions();
  }

  async getUpcomingSessions(): Promise<{ success: boolean; data: Session[] }> {
    const response = await sessionApi.getTutorSessions();
    return {
      success: response.success,
      data: response.data.filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status))
    };
  }

  completeSession(sessionId: string) {
    return sessionApi.completeSession(sessionId);
  }

  cancelSession(sessionId: string) {
    return sessionApi.cancelSession(sessionId);
  }

  async getEarnings(): Promise<{ success: boolean; data: Earnings }> {
    const wallet = await walletApi.getWallet();
    const transactions: Transaction[] = wallet.data.transactions || [];
    const incomeTypes = new Set<Transaction['type']>(['credit', 'release']);
    const totalEarned = transactions
      .filter(transaction => incomeTypes.has(transaction.type) && transaction.status === 'completed')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      success: wallet.success,
      data: {
        totalEarned,
        availableBalance: wallet.data.balance,
        pendingBalance: wallet.data.escrowIncoming || 0,
        lifetimeSessions: transactions.filter(transaction => transaction.sessionId).length,
        transactions
      }
    };
  }

  async getTransactions(): Promise<{ success: boolean; data: Transaction[] }> {
    const wallet = await walletApi.getWallet();
    return {
      success: wallet.success,
      data: wallet.data.transactions || []
    };
  }
}

export const tutorService = new TutorService();
