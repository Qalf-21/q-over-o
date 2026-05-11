/**
 * backend/controllers/walletController.js  (FULL REPLACEMENT)
 *
 * Wallet + M-Pesa Payment Controller for Q-over-o
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes handled:
 *   GET  /api/wallet                   → getBalance
 *   GET  /api/wallet/balance           → getBalance (alias)
 *   GET  /api/wallet/transactions      → getTransactions
 *   POST /api/wallet/purchase          → purchaseTokens  (initiates STK Push)
 *   GET  /api/wallet/purchase/:id/status → getPurchaseStatus
 *   POST /api/wallet/mpesa-callback    → handleMpesaCallback  (Safaricom only)
 *   GET  /api/wallet/spending          → getSpending
 *   POST /api/wallet/withdraw          → withdraw
 */

'use strict';

const { v4: uuidv4 }    = require('uuid');
const supabase           = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const { normalizePhoneOrThrow }  = require('../utils/phoneNormalizer');
const { logger, auditPayment, withCorrelationId } = require('../utils/logger');
const paymentService     = require('../services/paymentService');
const escrowService      = require('../services/escrowService');

// ── Get wallet balance + recent transactions ──────────────────────────────────

exports.getBalance = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('balance_tokens, updated_at')
    .eq('user_id', userId)
    .single();

  if (error || !wallet) {
    throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, amount_tokens, balance_after, status, reference, description, session_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  res.json({
    success: true,
    data: {
      balance:      wallet.balance_tokens,
      updatedAt:    wallet.updated_at,
      transactions: transactions || [],
    },
  });
});

// ── Get transactions (paginated) ──────────────────────────────────────────────

exports.getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const type   = req.query.type;  // optional filter

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('type', type);

  const { data, error, count } = await query;
  if (error) throw new AppError('Failed to fetch transactions', 500);

  res.json({ success: true, data, meta: { total: count, limit, offset } });
});

// ── Initiate token purchase via STK Push ──────────────────────────────────────

exports.purchaseTokens = asyncHandler(async (req, res) => {
  const userId        = req.user.id;
  const { amountKes, phoneNumber } = req.body;
  const correlationId = req.correlationId || uuidv4();
  const log           = withCorrelationId(correlationId, { userId });

  // ── Input validation ───────────────────────────────────────────────────────
  if (!amountKes || !phoneNumber) {
    throw new AppError('amountKes and phoneNumber are required', 400, 'MISSING_FIELDS');
  }

  log.info({ event: 'purchase_tokens_request', amountKes }, 'Token purchase requested');

  const result = await paymentService.purchaseTokens({
    userId,
    amountKes:   parseInt(amountKes, 10),
    phoneNumber,
    correlationId,
  });

  res.status(202).json({
    success: true,
    message: 'Payment request sent to your phone. Please enter your M-Pesa PIN.',
    data: {
      paymentIntentId:   result.paymentIntentId,
      checkoutRequestId: result.checkoutRequestId,
      tokensExpected:    result.tokensExpected,
      customerMessage:   result.customerMessage,
      correlationId:     result.correlationId,
    },
  });
});

// ── Poll payment intent status ────────────────────────────────────────────────

exports.getPurchaseStatus = asyncHandler(async (req, res) => {
  const userId          = req.user.id;
  const { intentId }    = req.params;

  const { data: intent, error } = await supabase
    .from('payment_intents')
    .select('id, status, tokens_expected, mpesa_receipt_number, created_at, updated_at, result_description')
    .eq('id', intentId)
    .eq('user_id', userId)
    .single();

  if (error || !intent) {
    throw new AppError('Payment intent not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: intent });
});

// ── M-Pesa Callback Handler ───────────────────────────────────────────────────

exports.handleMpesaCallback = asyncHandler(async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const log           = withCorrelationId(correlationId, { source: 'daraja_callback' });

  // ── ALWAYS respond 200 to Safaricom immediately ────────────────────────────
  // If we don't respond fast, Safaricom retries. We acknowledge first, process after.
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // ── Async processing continues after response ──────────────────────────────
  setImmediate(async () => {
    try {
      // ── 1. Safe payload extraction ──────────────────────────────────────────
      const body = req.body;

      if (!body || typeof body !== 'object') {
        log.warn({ event: 'callback_empty_body' }, 'Empty/non-object callback body');
        return;
      }

      // Daraja sends: { Body: { stkCallback: { ... } } }
      const stkCallback = body?.Body?.stkCallback;

      if (!stkCallback) {
        log.warn({ event: 'callback_malformed', body }, 'Malformed callback — missing stkCallback');
        return;
      }

      // ── 2. Validate required fields ──────────────────────────────────────────
      const { CheckoutRequestID, MerchantRequestID, ResultCode, ResultDesc } = stkCallback;

      if (!CheckoutRequestID || !MerchantRequestID || ResultCode === undefined) {
        log.warn({ event: 'callback_missing_fields', stkCallback },
          'Callback missing required fields');
        return;
      }

      auditPayment({
        event:              'callback_received',
        checkoutRequestId:  CheckoutRequestID,
        merchantRequestId:  MerchantRequestID,
        resultCode:         ResultCode,
        correlationId,
      });

      // ── 3. Delegate to payment service (verify + credit) ───────────────────
      const result = await paymentService.processCallback(stkCallback, correlationId);

      log.info({ event: 'callback_processed', result, correlationId }, 'Callback processing complete');

    } catch (err) {
      log.error({ event: 'callback_processing_error', err }, 'Error processing Daraja callback');
      // Errors are logged but do NOT affect the 200 response already sent.
      // The reconciliation job will catch any stuck 'processing' intents.
    }
  });
});

// ── Get spending summary ──────────────────────────────────────────────────────

exports.getSpending = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: escrowTxns } = await supabase
    .from('transactions')
    .select('amount_tokens')
    .eq('user_id', userId)
    .eq('type', 'escrow');

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance_tokens')
    .eq('user_id', userId)
    .single();

  const totalSpent = (escrowTxns || []).reduce((sum, t) => sum + (t.amount_tokens || 0), 0);

  res.json({
    success: true,
    data: {
      totalSpent,
      currentBalance: wallet?.balance_tokens || 0,
    },
  });
});

// ── Tutor withdrawal ──────────────────────────────────────────────────────────

exports.withdraw = asyncHandler(async (req, res) => {
  const userId        = req.user.id;
  const correlationId = req.correlationId || uuidv4();
  const { amount, phoneNumber, payoutMethod = 'mpesa' } = req.body;

  if (!amount || !phoneNumber) {
    throw new AppError('amount and phoneNumber are required', 400, 'MISSING_FIELDS');
  }

  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount < 1) {
    throw new AppError('Invalid withdrawal amount', 400, 'INVALID_AMOUNT');
  }

  const normalisedPhone = normalizePhoneOrThrow(phoneNumber, AppError);

  const result = await escrowService.initiateWithdrawal({
    tutorId:      userId,
    amountTokens: parsedAmount,
    phoneNumber:  normalisedPhone,
    correlationId,
  });

  res.json({
    success: true,
    message: 'Withdrawal request submitted. Processing within 24 hours.',
    data: result,
  });
});