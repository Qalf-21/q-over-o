// ─────────────────────────────────────────────────────────────────────────────
// src/api/walletApi.ts
//
// Fix: getPaymentStatus() was calling /wallet/payment-status/:id
//      but the backend route is /wallet/purchase/:intentId/status
//      → corrected to /wallet/purchase/${paymentIntentId}/status
// ─────────────────────────────────────────────────────────────────────────────

import { apiRequest } from './client';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentStatusResponse,
  WalletData,
  WalletTransaction,
} from '../types/wallet';

// ── Normalisers ───────────────────────────────────────────────────────────────

type RawTransaction = {
  id?: string;
  type?: WalletTransaction['type'];
  amount?: number;
  amount_tokens?: number;
  description?: string;
  reference?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  sessionId?: string;
  session_id?: string;
  mpesaReceiptNumber?: string;
  mpesa_receipt_number?: string;
};

type RawWallet = {
  balance?: number;
  balance_tokens?: number;
  escrowBalance?: number;
  escrow_balance?: number;
  totalDeposited?: number;
  total_deposited?: number;
  totalSpent?: number;
  total_spent?: number;
  transactions?: RawTransaction[];
};

type RawPaymentStatus = {
  id?: string;
  status?: PaymentStatusResponse['status'];
  tokensExpected?: number;
  tokens_expected?: number;
  mpesaReceiptNumber?: string;
  mpesa_receipt_number?: string;
  updatedAt?: string;
  updated_at?: string;
};

const normalizeTransaction = (t: RawTransaction): WalletTransaction => ({
  id:           t.id || '',
  type:         t.type || 'credit',
  amount:       Math.abs(t.amount ?? t.amount_tokens ?? 0),
  description:  t.description || t.reference || t.type || 'Wallet transaction',
  status:       t.status === 'success' ? 'completed' : ((t.status || 'completed') as WalletTransaction['status']),
  createdAt:    t.createdAt || t.created_at || '',
  sessionId:    t.sessionId || t.session_id,
  mpesaReceipt: t.mpesaReceiptNumber || t.mpesa_receipt_number,
});

const normalizeWallet = (w: RawWallet): WalletData => ({
  balance:        w.balance       ?? w.balance_tokens         ?? 0,
  escrowBalance:  w.escrowBalance ?? w.escrow_balance         ?? 0,
  totalDeposited: w.totalDeposited ?? w.total_deposited       ?? 0,
  totalSpent:     w.totalSpent    ?? w.total_spent            ?? 0,
  transactions:   (w.transactions || []).map(normalizeTransaction),
});

// ── API object ────────────────────────────────────────────────────────────────

export const walletApi = {
  /**
   * Fetch the authenticated user's wallet (balance + transaction history).
   */
  async getWallet(): Promise<{ success: boolean; data: WalletData }> {
    const response = await apiRequest<RawWallet>('/wallet', { method: 'GET' });
    return {
      success: response.success,
      data:    normalizeWallet(response.data || {}),
    };
  },

  /**
   * Initiate an M-Pesa STK Push deposit.
   * Returns a paymentIntentId used for status polling.
   *
   * @param amountKes   Amount in Kenyan Shillings (integer, min 10)
   * @param phoneNumber Raw phone — backend normalises to E.164 (254XXXXXXXXX)
   */
  async initiateDeposit(
    amountKes: number,
    phoneNumber: string,
  ): Promise<{ success: boolean; data: InitiatePaymentResponse }> {
    const body: InitiatePaymentRequest = { amountKes, phoneNumber };
    const response = await apiRequest<InitiatePaymentResponse>('/wallet/purchase', {
      method: 'POST',
      body,
    });
    return { success: response.success, data: response.data! };
  },

  async purchaseTokens(amountKes: number, phoneNumber: string) {
    return this.initiateDeposit(amountKes, phoneNumber);
  },

  /**
   * Poll the status of a payment intent.
   *
   * FIX: Previously called /wallet/payment-status/:id which does not exist.
   * Correct backend route is /wallet/purchase/:intentId/status
   */
  async getPaymentStatus(
    paymentIntentId: string,
  ): Promise<{ success: boolean; data: PaymentStatusResponse }> {
    const response = await apiRequest<RawPaymentStatus>(
      `/wallet/purchase/${paymentIntentId}/status`,
      { method: 'GET' },
    );
    const raw = response.data || {};
    return {
      success: response.success,
      data: {
        id: raw.id || paymentIntentId,
        status: raw.status || 'pending',
        tokensExpected: raw.tokensExpected ?? raw.tokens_expected ?? 0,
        mpesaReceiptNumber: raw.mpesaReceiptNumber ?? raw.mpesa_receipt_number,
        updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
      },
    };
  },

  /**
   * Initiate a tutor withdrawal via M-Pesa B2C.
   */
  async withdraw(
    amount: number,
    phoneNumber: string,
    payoutMethod = 'mpesa',
  ) {
    return apiRequest('/wallet/withdraw', {
      method: 'POST',
      body: { amount, phoneNumber, payoutMethod },
    });
  },
};
