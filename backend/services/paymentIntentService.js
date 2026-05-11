/**
 * backend/services/paymentIntentService.js
 *
 * Payment Intent Lifecycle Manager
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the full lifecycle:
 *   initiated → pending → processing → completed | failed | cancelled | expired | reversed
 *
 * Idempotency rules:
 *   — duplicate callbacks are silently ignored
 *   — wallet is NEVER credited if intent is already completed
 *   — all writes go through Supabase RPC for atomicity
 */

'use strict';

const supabase       = require('../config/supabase');
const { AppError }   = require('../utils/errorHandler');
const { auditPayment, auditWallet, logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// ── Allowed status transitions ────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  initiated:  ['pending', 'cancelled', 'expired'],
  pending:    ['processing', 'failed', 'cancelled', 'expired'],
  processing: ['completed', 'failed', 'reversed'],
  completed:  [],            // terminal
  failed:     ['reversed'],  // allow reversals for reconciliation
  cancelled:  [],            // terminal
  expired:    [],            // terminal
  reversed:   [],            // terminal
};

function assertTransition(from, to) {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(
      `Invalid status transition: ${from} → ${to}`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

// ── Token conversion ──────────────────────────────────────────────────────────
/** 1 KES = 1 token (adjust this ratio via env if pricing changes) */
function kesToTokens(amountKes) {
  const ratio = parseFloat(process.env.TOKEN_CONVERSION_RATE || '1');
  return Math.floor(amountKes * ratio);
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new payment intent with status = 'initiated'.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} params.amountKes
 * @param {string} params.phoneNumber  - Already normalised (2547XXXXXXXX)
 * @param {string} params.correlationId
 *
 * @returns {object} paymentIntent row
 */
async function createPaymentIntent({ userId, amountKes, phoneNumber, correlationId }) {
  if (!Number.isInteger(amountKes) || amountKes < 1) {
    throw new AppError('Amount must be a positive integer (KES)', 400, 'INVALID_AMOUNT');
  }

  // Idempotency key: reuse an existing initiated intent for the same user + amount
  // to survive double-taps on the client side.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('payment_intents')
    .select('id, status')
    .eq('user_id', userId)
    .eq('amount_kes', amountKes)
    .eq('phone_number', phoneNumber)
    .eq('status', 'initiated')
    .gte('created_at', fiveMinAgo)
    .maybeSingle();

  if (existing) {
    logger.info({ event: 'payment_intent_reused', id: existing.id, correlationId },
      'Reusing existing initiated payment intent');
    return existing;
  }

  const tokensExpected = kesToTokens(amountKes);

  const { data, error } = await supabase
    .from('payment_intents')
    .insert({
      user_id:          userId,
      amount_kes:       amountKes,
      tokens_expected:  tokensExpected,
      phone_number:     phoneNumber,
      status:           'initiated',
      correlation_id:   correlationId || uuidv4(),
    })
    .select()
    .single();

  if (error) throw new AppError(`Failed to create payment intent: ${error.message}`, 500);

  auditPayment({
    event:          'payment_intent_created',
    paymentIntentId: data.id,
    userId,
    amountKes,
    tokensExpected,
    correlationId,
  });

  return data;
}

// ── Attach STK response ───────────────────────────────────────────────────────

/**
 * After a successful STK Push, attach the checkout/merchant IDs.
 */
async function attachStkIds({ paymentIntentId, checkoutRequestId, merchantRequestId, correlationId }) {
  const { data: current } = await supabase
    .from('payment_intents')
    .select('status')
    .eq('id', paymentIntentId)
    .single();

  assertTransition(current?.status, 'pending');

  const { data, error } = await supabase
    .from('payment_intents')
    .update({
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      status:              'pending',
      updated_at:          new Date().toISOString(),
    })
    .eq('id', paymentIntentId)
    .select()
    .single();

  if (error) throw new AppError(`Failed to attach STK IDs: ${error.message}`, 500);

  auditPayment({
    event:              'payment_intent_pending',
    paymentIntentId,
    checkoutRequestId,
    correlationId,
  });

  return data;
}

// ── Get by checkout request ID ────────────────────────────────────────────────

async function getByCheckoutRequestId(checkoutRequestId) {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (error) throw new AppError(`DB error fetching payment intent: ${error.message}`, 500);
  return data;
}

// ── Mark processing ───────────────────────────────────────────────────────────

async function markProcessing(paymentIntentId, correlationId) {
  const { data: current } = await supabase
    .from('payment_intents')
    .select('status')
    .eq('id', paymentIntentId)
    .single();

  assertTransition(current?.status, 'processing');

  const { error } = await supabase
    .from('payment_intents')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', paymentIntentId);

  if (error) throw new AppError(`Failed to mark intent as processing: ${error.message}`, 500);

  auditPayment({ event: 'payment_intent_processing', paymentIntentId, correlationId });
}

// ── Complete payment (atomic via RPC) ─────────────────────────────────────────

/**
 * Atomically:
 *   1. Mark payment intent as completed
 *   2. Credit user wallet
 *   3. Insert transaction ledger entry
 *
 * Idempotent: silently returns if intent is already completed.
 *
 * Uses a PostgreSQL RPC function for true atomicity.
 *
 * @returns {{ tokensAdded, newBalance }}
 */
async function completePaymentAtomic({
  paymentIntentId,
  mpesaReceiptNumber,
  resultCode,
  resultDescription,
  callbackPayload,
  correlationId,
}) {
  // ── Idempotency check ────────────────────────────────────────────────────────
  const { data: intent, error: fetchErr } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', paymentIntentId)
    .single();

  if (fetchErr || !intent) {
    throw new AppError(`Payment intent not found: ${paymentIntentId}`, 404, 'INTENT_NOT_FOUND');
  }

  if (intent.status === 'completed') {
    logger.warn(
      { event: 'duplicate_completion_skipped', paymentIntentId, correlationId },
      'Payment intent already completed — skipping duplicate credit',
    );
    return { tokensAdded: 0, newBalance: null, duplicate: true };
  }

  assertTransition(intent.status, 'completed');

  // ── Atomic RPC call ──────────────────────────────────────────────────────────
  const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_payment_and_credit_wallet', {
    p_payment_intent_id:    paymentIntentId,
    p_user_id:              intent.user_id,
    p_tokens_to_add:        intent.tokens_expected,
    p_mpesa_receipt_number: mpesaReceiptNumber,
    p_result_code:          String(resultCode),
    p_result_description:   resultDescription,
    p_callback_payload:     callbackPayload,
    p_correlation_id:       correlationId,
    p_completed_at:         new Date().toISOString(),
  });

  if (rpcError) {
    logger.error(
      { event: 'atomic_credit_failed', rpcError, paymentIntentId, correlationId },
      'Atomic wallet credit RPC failed',
    );
    throw new AppError(`Atomic payment completion failed: ${rpcError.message}`, 500, 'ATOMIC_CREDIT_FAILED');
  }

  auditWallet({
    event:              'wallet_credited',
    paymentIntentId,
    userId:             intent.user_id,
    tokensAdded:        intent.tokens_expected,
    mpesaReceiptNumber,
    correlationId,
  });

  return {
    tokensAdded:  rpcResult.tokens_added,
    newBalance:   rpcResult.new_balance,
    duplicate:    false,
  };
}

// ── Mark failed ───────────────────────────────────────────────────────────────

async function markFailed({ paymentIntentId, resultCode, resultDescription, callbackPayload, correlationId }) {
  const { data: current } = await supabase
    .from('payment_intents')
    .select('status')
    .eq('id', paymentIntentId)
    .single();

  if (!current || ['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
    logger.warn({ event: 'mark_failed_skipped', paymentIntentId, currentStatus: current?.status, correlationId },
      'Skipping markFailed — already terminal');
    return;
  }

  const { error } = await supabase
    .from('payment_intents')
    .update({
      status:             'failed',
      result_code:        String(resultCode),
      result_description: resultDescription,
      callback_payload:   callbackPayload,
      failed_at:          new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    .eq('id', paymentIntentId);

  if (error) throw new AppError(`Failed to mark intent as failed: ${error.message}`, 500);

  auditPayment({
    event: 'payment_intent_failed',
    paymentIntentId,
    resultCode,
    resultDescription,
    correlationId,
  });
}

// ── Get user intents ──────────────────────────────────────────────────────────

async function getUserPaymentIntents(userId, { limit = 20, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('payment_intents')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new AppError(`Failed to fetch payment intents: ${error.message}`, 500);
  return { data, count };
}

module.exports = {
  createPaymentIntent,
  attachStkIds,
  getByCheckoutRequestId,
  markProcessing,
  completePaymentAtomic,
  markFailed,
  getUserPaymentIntents,
  kesToTokens,
};