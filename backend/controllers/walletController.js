'use strict';

/**
 * backend/controllers/walletController.js
 *
 * Fix: getBalance() now upserts the wallet row when it doesn't exist yet,
 * so new users don't hit WALLET_NOT_FOUND on first load.
 */

const { v4: uuidv4 }    = require('uuid');
const supabase           = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const { normalizePhoneOrThrow }  = require('../utils/phoneNormalizer');
const { logger, auditPayment, withCorrelationId } = require('../utils/logger');
const paymentService     = require('../services/paymentService');
const escrowService      = require('../services/escrowService');
const { initiateB2CPayment } = require('../services/darajaService');

const TOKENS_PER_KES = 10;
const MIN_WITHDRAWAL_TOKENS = 100;

const tokensToKes = (tokens) => tokens / TOKENS_PER_KES;

// ── Helper: get or auto-create wallet ────────────────────────────────────────

async function getOrCreateWallet(userId) {
  // Try to fetch first (fast path for existing users)
  const { data: existing, error: fetchError } = await supabase
    .from('wallets')
    .select('balance_tokens, total_deposited_kes, updated_at')
    .eq('user_id', userId)
    .single();

  if (existing) return existing;

  // Row doesn't exist (PGRST116 = "no rows") — create it
  if (fetchError && fetchError.code !== 'PGRST116') {
    // Real DB error, not just "not found"
    throw new AppError(`Wallet fetch failed: ${fetchError.message}`, 500, 'WALLET_FETCH_ERROR');
  }

  const { data: created, error: createError } = await supabase
    .from('wallets')
    .insert({ user_id: userId, balance_tokens: 0 })
    .select('balance_tokens, total_deposited_kes, updated_at')
    .single();

  if (createError) {
    // Could be a race condition where another request already created it —
    // try one more fetch before giving up.
    const { data: raceWallet } = await supabase
      .from('wallets')
      .select('balance_tokens, total_deposited_kes, updated_at')
      .eq('user_id', userId)
      .single();

    if (raceWallet) return raceWallet;

    throw new AppError(`Could not create wallet: ${createError.message}`, 500, 'WALLET_CREATE_ERROR');
  }

  return created;
}

// ── Get wallet balance + recent transactions ──────────────────────────────────

exports.getBalance = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await getOrCreateWallet(userId);

  const [{ data: transactions }, { data: escrowRows }, { data: spendingRows }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount_tokens, balance_after, status, reference, description, session_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('escrow')
      .select('amount_tokens, payer_id, payee_id, status')
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`),
    supabase
      .from('transactions')
      .select('type, amount_tokens')
      .eq('user_id', userId)
      .in('type', ['escrow', 'debit', 'withdrawal']),
  ]);

  const allTransactions = transactions || [];
  const lockedEscrowRows = (escrowRows || []).filter(row => row.status === 'locked');
  const escrowIncoming = lockedEscrowRows
    .filter(row => row.payee_id === userId)
    .reduce((sum, row) => sum + Number(row.amount_tokens || 0), 0);
  const escrowOutgoing = lockedEscrowRows
    .filter(row => row.payer_id === userId)
    .reduce((sum, row) => sum + Number(row.amount_tokens || 0), 0);
  const escrowBalance = escrowIncoming + escrowOutgoing;
  const totalSpent = (spendingRows || [])
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount_tokens || 0)), 0);

  res.json({
    success: true,
    data: {
      balance:      wallet.balance_tokens,
      balance_tokens: wallet.balance_tokens,
      escrowBalance,
      escrow_balance: escrowBalance,
      escrowIncoming,
      escrow_incoming: escrowIncoming,
      escrowOutgoing,
      escrow_outgoing: escrowOutgoing,
      totalDeposited: Number(wallet.total_deposited_kes || 0) * TOKENS_PER_KES,
      total_deposited: Number(wallet.total_deposited_kes || 0) * TOKENS_PER_KES,
      totalSpent,
      total_spent: totalSpent,
      updatedAt:    wallet.updated_at,
      transactions: allTransactions,
    },
  });
});

// ── Get transactions (paginated) ──────────────────────────────────────────────

exports.getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const type   = req.query.type;

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

  if (!amountKes || !phoneNumber) {
    throw new AppError('amountKes and phoneNumber are required', 400, 'MISSING_FIELDS');
  }

  log.info({ event: 'purchase_tokens_request', amountKes }, 'Token purchase requested');

  const result = await paymentService.purchaseTokens({
    userId,
    amountKes,
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
  const userId       = req.user.id;
  const { intentId } = req.params;

  const { data: intent, error } = await supabase
    .from('payment_intents')
    .select('id, status, tokens_expected, mpesa_receipt_number, checkout_request_id, created_at, updated_at, completed_at, result_description')
    .eq('id', intentId)
    .eq('user_id', userId)
    .single();

  if (error || !intent) {
    throw new AppError('Payment intent not found', 404, 'NOT_FOUND');
  }

  let currentIntent = intent;
  if (['pending', 'processing'].includes(intent.status)) {
    try {
      currentIntent = await paymentService.reconcilePendingIntent(
        intent,
        req.correlationId || uuidv4(),
      );
    } catch (reconcileError) {
      logger.warn(
        { event: 'payment_status_reconcile_failed', intentId, err: reconcileError.message },
        'Payment status reconciliation failed; returning stored status',
      );
    }
  }

  res.json({ success: true, data: currentIntent });
});

// ── Poll payment status by CheckoutRequestID ─────────────────────────────────
// This endpoint returns the stored payment intent and opportunistically runs
// the same bounded Daraja reconciliation used by intent-id polling while the
// payment is still pending or processing.

exports.getPurchaseStatusByCheckoutRequestId = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { checkoutRequestId } = req.params;

  if (!checkoutRequestId) {
    throw new AppError('CheckoutRequestID is required', 400, 'MISSING_CHECKOUT_REQUEST_ID');
  }

  const { data: intent, error } = await supabase
    .from('payment_intents')
    .select('id, status, tokens_expected, mpesa_receipt_number, checkout_request_id, created_at, updated_at, completed_at, result_description')
    .eq('checkout_request_id', checkoutRequestId)
    .eq('user_id', userId)
    .single();

  if (error || !intent) {
    throw new AppError('Payment intent not found', 404, 'NOT_FOUND');
  }

  let currentIntent = intent;
  if (['pending', 'processing'].includes(intent.status)) {
    try {
      currentIntent = await paymentService.reconcilePendingIntent(
        intent,
        req.correlationId || uuidv4(),
      );
    } catch (reconcileError) {
      logger.warn(
        { event: 'checkout_payment_status_reconcile_failed', checkoutRequestId, err: reconcileError.message },
        'Checkout payment status reconciliation failed; returning stored status',
      );
    }
  }

  const status = (
    ['pending', 'processing'].includes(currentIntent.status) &&
    (currentIntent.mpesa_receipt_number || currentIntent.completed_at)
  )
    ? 'completed'
    : currentIntent.status;

  res.json({
    success: true,
    data: {
      id: currentIntent.id,
      status,
      tokens_expected: currentIntent.tokens_expected,
      mpesa_receipt_number: currentIntent.mpesa_receipt_number,
      checkout_request_id: currentIntent.checkout_request_id,
      result_description: currentIntent.result_description,
      created_at: currentIntent.created_at,
      updated_at: currentIntent.updated_at,
    },
  });
});

// ── M-Pesa Callback Handler ───────────────────────────────────────────────────

exports.handleMpesaCallback = asyncHandler(async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const log           = withCorrelationId(correlationId, { source: 'daraja_callback' });

  // ALWAYS respond 200 to Safaricom immediately to prevent retries
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  setImmediate(async () => {
    try {
      const body = req.body;

      if (!body || typeof body !== 'object') {
        log.warn({ event: 'callback_empty_body' }, 'Empty/non-object callback body');
        return;
      }

      const stkCallback = body?.Body?.stkCallback;

      if (!stkCallback) {
        log.warn({ event: 'callback_malformed', body }, 'Malformed callback — missing stkCallback');
        return;
      }

      const { CheckoutRequestID, MerchantRequestID, ResultCode } = stkCallback;

      if (!CheckoutRequestID || !MerchantRequestID || ResultCode === undefined) {
        log.warn({ event: 'callback_missing_fields', stkCallback }, 'Callback missing required fields');
        return;
      }

      auditPayment({
        event:             'callback_received',
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        resultCode:        ResultCode,
        correlationId,
      });

      const result = await paymentService.processCallback(stkCallback, correlationId);
      log.info({ event: 'callback_processed', result, correlationId }, 'Callback processing complete');

    } catch (err) {
      log.error({ event: 'callback_processing_error', err }, 'Error processing Daraja callback');
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

  const wallet = await getOrCreateWallet(userId);

  const totalSpent = (escrowTxns || []).reduce((sum, t) => sum + (t.amount_tokens || 0), 0);

  res.json({
    success: true,
    data: {
      totalSpent,
      currentBalance: wallet.balance_tokens || 0,
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
  if (!Number.isInteger(parsedAmount) || parsedAmount < MIN_WITHDRAWAL_TOKENS) {
    throw new AppError(
      `Minimum withdrawal is ${MIN_WITHDRAWAL_TOKENS} tokens (KES ${tokensToKes(MIN_WITHDRAWAL_TOKENS)})`,
      400,
      'WITHDRAWAL_AMOUNT_TOO_LOW',
    );
  }

  if (parsedAmount % TOKENS_PER_KES !== 0) {
    throw new AppError(
      `Withdrawal amount must be a multiple of ${TOKENS_PER_KES} tokens`,
      400,
      'INVALID_WITHDRAWAL_INCREMENT',
    );
  }

  if (payoutMethod !== 'mpesa') {
    throw new AppError('Only M-Pesa withdrawals are currently supported', 400, 'UNSUPPORTED_PAYOUT_METHOD');
  }

  const normalisedPhone = normalizePhoneOrThrow(phoneNumber, AppError);
  const amountKes = tokensToKes(parsedAmount);

  const result = await escrowService.initiateWithdrawal({
    tutorId:      userId,
    amountTokens: parsedAmount,
    phoneNumber:  normalisedPhone,
    correlationId,
  });

  try {
    const b2c = await initiateB2CPayment({
      phone: normalisedPhone,
      amountKes,
      remarks: `Q-over-o tutor withdrawal`,
      occasion: result.payout_id || correlationId,
      correlationId,
    });

    await escrowService.markWithdrawalProcessing({
      payoutId: result.payout_id,
      originatorConversationId: b2c.originatorConversationId,
      conversationId: b2c.conversationId,
      correlationId,
    });

    res.status(202).json({
      success: true,
      message: 'Withdrawal sent to M-Pesa. You should receive it shortly.',
      data: {
        ...result,
        amountTokens: parsedAmount,
        amountKes,
        phoneNumber: normalisedPhone,
        originatorConversationId: b2c.originatorConversationId,
        conversationId: b2c.conversationId,
        responseDescription: b2c.responseDescription,
        correlationId,
      },
    });
  } catch (err) {
    await escrowService.refundWithdrawal({
      payoutId: result.payout_id,
      tutorId: userId,
      amountTokens: parsedAmount,
      reason: err instanceof Error ? err.message : 'M-Pesa B2C request failed',
      correlationId,
    });

    throw err;
  }
});

// ── M-Pesa B2C Result Handler ────────────────────────────────────────────────

exports.handleB2CResult = asyncHandler(async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  setImmediate(async () => {
    const body = req.body || {};
    const result = body.Result || body;
    const resultCode = String(result.ResultCode ?? result.resultCode ?? '-1');
    const originatorConversationId = result.OriginatorConversationID || result.OriginatorConversationId;
    const transactionId = result.TransactionID || result.TransactionId || null;

    auditPayment({
      event: 'b2c_result_received',
      originatorConversationId,
      resultCode,
      transactionId,
      correlationId,
    });

    const payout = await escrowService.findWithdrawalByOriginatorConversationId(originatorConversationId);
    if (!payout) return;

    const payoutId = payout.id || payout.payout_id;
    const tutorId = payout.tutor_id || payout.user_id;
    const amountTokens = Number(payout.amount_tokens || payout.amount || 0);

    if (resultCode === '0') {
      await escrowService.markWithdrawalSucceeded({
        payoutId,
        transactionId,
        resultPayload: body,
        correlationId,
      });
      return;
    }

    await escrowService.refundWithdrawal({
      payoutId,
      tutorId,
      amountTokens,
      reason: result.ResultDesc || result.ResultDescription || 'M-Pesa B2C payout failed',
      resultPayload: body,
      correlationId,
    });
  });
});

// ── M-Pesa B2C Timeout Handler ───────────────────────────────────────────────

exports.handleB2CTimeout = asyncHandler(async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  setImmediate(async () => {
    const body = req.body || {};
    const result = body.Result || body;
    const originatorConversationId = result.OriginatorConversationID || result.OriginatorConversationId;

    auditPayment({
      event: 'b2c_timeout_received',
      originatorConversationId,
      correlationId,
    });

    const payout = await escrowService.findWithdrawalByOriginatorConversationId(originatorConversationId);
    if (!payout) return;

    await escrowService.refundWithdrawal({
      payoutId: payout.id || payout.payout_id,
      tutorId: payout.tutor_id || payout.user_id,
      amountTokens: Number(payout.amount_tokens || payout.amount || 0),
      reason: 'M-Pesa B2C request timed out',
      resultPayload: body,
      correlationId,
    });
  });
});
