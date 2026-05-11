// ─────────────────────────────────────────────────────────────────────────────
// src/api/walletApi.ts  (FULL REPLACEMENT)
//
// Adds:
//   • initiateDeposit()      — POST /wallet/purchase → STK Push + intent ID
//   • getPaymentStatus()     — GET  /wallet/payment-status/:id
//   • getWallet()            — GET  /wallet  (extended, normalises new fields)
//   • withdraw()             — POST /wallet/withdraw (unchanged signature)
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

const normalizeTransaction = (t: any): WalletTransaction => ({
  id:           t.id,
  type:         t.type || 'credit',
  amount:       Math.abs(t.amount ?? t.amount_tokens ?? 0),
  description:  t.description || t.reference || t.type || 'Wallet transaction',
  status:       t.status || 'completed',
  createdAt:    t.createdAt || t.created_at || '',
  sessionId:    t.sessionId || t.session_id,
  mpesaReceipt: t.mpesaReceiptNumber || t.mpesa_receipt_number,
});

const normalizeWallet = (w: any): WalletData => ({
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
    const response = await apiRequest<any>('/wallet', { method: 'GET' });
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

  /**
   * Poll the status of a payment intent.
   * Safe to call repeatedly; backend only verifies against its own state.
   */
  async getPaymentStatus(
    paymentIntentId: string,
  ): Promise<{ success: boolean; data: PaymentStatusResponse }> {
    const response = await apiRequest<PaymentStatusResponse>(
      `/wallet/payment-status/${paymentIntentId}`,
      { method: 'GET' },
    );
    return { success: response.success, data: response.data! };
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