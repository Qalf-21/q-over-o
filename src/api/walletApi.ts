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
  escrowIncoming?: number;
  escrow_incoming?: number;
  escrowOutgoing?: number;
  escrow_outgoing?: number;
  totalDeposited?: number;
  total_deposited?: number;
  total_deposited_kes?: number;
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
  checkoutRequestId?: string;
  checkout_request_id?: string;
  resultDescription?: string;
  result_description?: string;
  updatedAt?: string;
  updated_at?: string;
};

const normalizePaymentStatus = (
  status?: string,
): PaymentStatusResponse['status'] => {
  const normalized = String(status || 'pending').toLowerCase();
  if (['completed', 'complete', 'success', 'successful', 'paid', 'confirmed'].includes(normalized)) {
    return 'completed';
  }
  if (['failed', 'failure', 'declined', 'rejected', 'error'].includes(normalized)) {
    return 'failed';
  }
  if (['cancelled', 'canceled', 'cancel'].includes(normalized)) {
    return 'cancelled';
  }
  if (['timeout', 'timed_out', 'expired'].includes(normalized)) {
    return 'timeout';
  }
  if (normalized === 'processing') {
    return normalized;
  }
  return 'pending';
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
  escrowIncoming: w.escrowIncoming ?? w.escrow_incoming       ?? 0,
  escrowOutgoing: w.escrowOutgoing ?? w.escrow_outgoing       ?? 0,
  totalDeposited: w.totalDeposited ?? w.total_deposited ?? ((w.total_deposited_kes ?? 0) * 10),
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
        status: normalizePaymentStatus(raw.status),
        tokensExpected: raw.tokensExpected ?? raw.tokens_expected ?? 0,
        mpesaReceiptNumber: raw.mpesaReceiptNumber ?? raw.mpesa_receipt_number,
        checkoutRequestId: raw.checkoutRequestId ?? raw.checkout_request_id,
        resultDescription: raw.resultDescription ?? raw.result_description,
        updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
      },
    };
  },

  /**
   * Poll the stored payment intent status using Daraja's CheckoutRequestID.
   * This remains authenticated and the backend verifies the intent belongs to
   * the current user before returning anything.
   */
  async getPaymentStatusByCheckoutRequestId(
    checkoutRequestId: string,
  ): Promise<{ success: boolean; data: PaymentStatusResponse }> {
    const response = await apiRequest<RawPaymentStatus>(
      `/wallet/purchase/checkout/${encodeURIComponent(checkoutRequestId)}/status`,
      { method: 'GET' },
    );
    const raw = response.data || {};
    return {
      success: response.success,
      data: {
        id: raw.id || '',
        status: normalizePaymentStatus(raw.status),
        tokensExpected: raw.tokensExpected ?? raw.tokens_expected ?? 0,
        mpesaReceiptNumber: raw.mpesaReceiptNumber ?? raw.mpesa_receipt_number,
        checkoutRequestId: raw.checkoutRequestId ?? raw.checkout_request_id ?? checkoutRequestId,
        resultDescription: raw.resultDescription ?? raw.result_description,
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
