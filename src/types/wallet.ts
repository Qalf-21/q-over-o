// ─────────────────────────────────────────────────────────────────────────────
// src/types/wallet.ts
// All TypeScript types for the M-Pesa payment + wallet system
// ─────────────────────────────────────────────────────────────────────────────

// ── Payment Intent ────────────────────────────────────────────────────────────

export type PaymentIntentStatus =
  | 'pending'       // STK Push initiated, waiting for user to enter PIN
  | 'processing'    // Callback received, verifying + crediting
  | 'completed'     // Tokens credited to wallet
  | 'failed'        // Payment explicitly failed (wrong PIN, declined, etc.)
  | 'cancelled'     // User cancelled on their phone
  | 'timeout';      // No callback received within the window

export interface PaymentIntent {
  id: string;
  status: PaymentIntentStatus;
  amountKes: number;
  tokensExpected: number;
  phoneNumber: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// ── STK Push ─────────────────────────────────────────────────────────────────

export interface InitiatePaymentRequest {
  amountKes: number;
  phoneNumber: string; // raw — backend normalises
}

export interface InitiatePaymentResponse {
  paymentIntentId: string;
  checkoutRequestId: string;
  message: string;
}

// ── Payment Status Polling ────────────────────────────────────────────────────

export interface PaymentStatusResponse {
  id: string;
  status: PaymentIntentStatus;
  tokensExpected: number;
  mpesaReceiptNumber?: string;
  updatedAt: string;
}

// ── Token Packages ────────────────────────────────────────────────────────────

export interface TokenPackage {
  id: string;
  label: string;
  amountKes: number;
  tokens: number;
  badge?: string;        // e.g. "Popular", "Best Value"
  badgeColor?: string;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletData {
  balance: number;             // current spendable tokens
  escrowBalance: number;       // tokens locked in escrow
  totalDeposited: number;      // lifetime tokens deposited
  totalSpent: number;          // lifetime tokens spent
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'escrow' | 'release' | 'withdrawal' | 'refund' | 'credit' | 'debit';
  amount: number;              // always positive; direction inferred from type
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  sessionId?: string;
  mpesaReceipt?: string;
}

// ── Phone Validation ──────────────────────────────────────────────────────────

export type PhoneValidationResult =
  | { valid: true;  normalized: string; display: string }
  | { valid: false; error: string };

// ── Toast / Notification ──────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'pending' | 'warning' | 'info';

export interface ToastPayload {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;         // ms; 0 = persistent
}

// ── Deposit Modal Steps ───────────────────────────────────────────────────────

export type DepositStep =
  | 'form'         // amount + phone entry
  | 'confirm'      // review before sending STK
  | 'pending'      // STK Push sent, waiting for PIN
  | 'success'      // payment confirmed
  | 'failed'       // payment failed
  | 'timeout';     // polling timed out

// ── Hook return types ─────────────────────────────────────────────────────────

export interface UseDepositReturn {
  step: DepositStep;
  amountKes: number;
  phone: string;
  paymentIntentId: string | null;
  tokensToReceive: number;
  isSubmitting: boolean;
  error: string | null;
  setAmountKes: (v: number) => void;
  setPhone: (v: string) => void;
  initiateDeposit: () => Promise<void>;
  reset: () => void;
}

export interface UseWalletReturn {
  wallet: WalletData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UsePaymentPollingReturn {
  status: PaymentIntentStatus | null;
  receipt: string | null;
  tokensAdded: number | null;
  isPolling: boolean;
  stopPolling: () => void;
}