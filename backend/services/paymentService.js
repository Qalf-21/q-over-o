/**
 * backend/services/paymentService.js  (FULL REPLACEMENT)
 *
 * Production Daraja Payment Orchestrator for Q-over-o
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the prototype paymentService.js.
 *
 * Flow:
 *   purchaseTokens()
 *     → normalise phone
 *     → create payment intent (initiated)
 *     → STK Push via darajaService
 *     → attach checkout IDs (pending)
 *     → return to client
 *
 * Callback flow (see callbackHandler in walletController):
 *   receive callback
 *     → parse + validate payload
 *     → look up intent by checkoutRequestId
 *     → mark processing
 *     → query Safaricom to VERIFY (queryStkStatus)
 *     → if verified: completePaymentAtomic (credit wallet)
 *     → if failed:   markFailed
 *
 * Nothing in this file credits wallets.
 * Wallet crediting is ONLY done by completePaymentAtomic() which is atomic.
 */

'use strict';

const { v4: uuidv4 }                   = require('uuid');
const { AppError }                     = require('../utils/errorHandler');
const { normalizePhoneOrThrow }        = require('../utils/phoneNormalizer');
const { logger, auditPayment }         = require('../utils/logger');
const { initiateSTKPush, queryStkStatus } = require('./darajaService');
const {
  createPaymentIntent,
  attachStkIds,
  getByCheckoutRequestId,
  markProcessing,
  completePaymentAtomic,
  markFailed,
  kesToTokens,
}                                      = require('./paymentIntentService');

class PaymentService {
  /**
   * Initiate a token purchase via M-Pesa STK Push.
   *
   * @param {object} params
   * @param {string} params.userId       - Authenticated user ID
   * @param {number} params.amountKes    - Amount in KES
   * @param {string} params.phoneNumber  - Raw phone from client
   * @param {string} [params.correlationId]
   *
   * @returns {{ paymentIntentId, checkoutRequestId, customerMessage, tokensExpected }}
   */
  async purchaseTokens({ userId, amountKes, phoneNumber, correlationId }) {
    const traceId = correlationId || uuidv4();

    // ── 1. Validate & normalise phone ──────────────────────────────────────────
    const normalisedPhone = normalizePhoneOrThrow(phoneNumber, AppError);

    // ── 2. Validate amount ─────────────────────────────────────────────────────
    const parsedAmount = parseInt(amountKes, 10);
    if (isNaN(parsedAmount) || parsedAmount < 10) {
      throw new AppError('Minimum purchase is KES 10', 400, 'AMOUNT_TOO_LOW');
    }
    if (parsedAmount > 150_000) {
      throw new AppError('Maximum single purchase is KES 150,000', 400, 'AMOUNT_TOO_HIGH');
    }

    const tokensExpected = kesToTokens(parsedAmount);

    auditPayment({
      event:  'purchase_initiated',
      userId,
      amountKes: parsedAmount,
      tokensExpected,
      correlationId: traceId,
    });

    // ── 3. Create payment intent ───────────────────────────────────────────────
    const intent = await createPaymentIntent({
      userId,
      amountKes:   parsedAmount,
      phoneNumber: normalisedPhone,
      correlationId: traceId,
    });

    // ── 4. STK Push ────────────────────────────────────────────────────────────
    let stkResponse;
    try {
      stkResponse = await initiateSTKPush({
        phone:             normalisedPhone,
        amountKes:         parsedAmount,
        accountReference:  `QOVERO${intent.id.slice(0, 6).toUpperCase()}`,
        description:       'Token Purchase',
        correlationId:     traceId,
      });
    } catch (err) {
      // STK push failed — mark intent as failed and surface error to client
      await markFailed({
        paymentIntentId:   intent.id,
        resultCode:        '-1',
        resultDescription: err.message,
        callbackPayload:   null,
        correlationId:     traceId,
      }).catch(innerErr => logger.error({ innerErr }, 'Could not mark intent failed after STK error'));

      throw err; // re-throw original AppError
    }

    // ── 5. Attach STK IDs → status: pending ───────────────────────────────────
    await attachStkIds({
      paymentIntentId:  intent.id,
      checkoutRequestId: stkResponse.checkoutRequestId,
      merchantRequestId: stkResponse.merchantRequestId,
      correlationId:    traceId,
    });

    return {
      paymentIntentId:   intent.id,
      checkoutRequestId: stkResponse.checkoutRequestId,
      customerMessage:   stkResponse.customerMessage,
      tokensExpected,
      correlationId:     traceId,
    };
  }

  /**
   * Process a Daraja STK Push callback.
   *
   * Called by the callback handler AFTER it has validated the payload shape.
   * This method:
   *   1. Identifies the payment intent
   *   2. Marks it as 'processing'
   *   3. Queries Safaricom to independently VERIFY the transaction
   *   4. Only then credits the wallet (atomically)
   *
   * @param {object} stkCallback  - The stkCallback object from Daraja
   * @param {string} correlationId
   *
   * @returns {{ processed: boolean, duplicate?: boolean }}
   */
  async processCallback(stkCallback, correlationId) {
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode        = stkCallback.ResultCode;
    const resultDesc        = stkCallback.ResultDesc;

    // ── 1. Find payment intent ─────────────────────────────────────────────────
    const intent = await getByCheckoutRequestId(checkoutRequestId);

    if (!intent) {
      logger.warn(
        { event: 'callback_orphan', checkoutRequestId, correlationId },
        'Callback received for unknown checkoutRequestId — ignoring',
      );
      return { processed: false, reason: 'no_matching_intent' };
    }

    // ── 2. Idempotency — skip if already terminal ──────────────────────────────
    if (['completed', 'failed', 'cancelled', 'expired', 'reversed'].includes(intent.status)) {
      logger.info(
        { event: 'callback_duplicate_skipped', intentId: intent.id, status: intent.status, correlationId },
        'Duplicate callback — intent already in terminal state',
      );
      return { processed: true, duplicate: true };
    }

    // ── 3. Mark processing (prevents race conditions) ──────────────────────────
    await markProcessing(intent.id, correlationId);

    // ── 4. Payment failed per callback ────────────────────────────────────────
    if (resultCode !== 0) {
      auditPayment({
        event:           'callback_payment_failed',
        intentId:        intent.id,
        checkoutRequestId,
        resultCode,
        resultDesc,
        correlationId,
      });

      await markFailed({
        paymentIntentId:   intent.id,
        resultCode,
        resultDescription: resultDesc,
        callbackPayload:   stkCallback,
        correlationId,
      });

      return { processed: true, success: false, resultCode, resultDesc };
    }

    // ── 5. Extract receipt from callback metadata ──────────────────────────────
    const items = stkCallback.CallbackMetadata?.Item || [];
    const findItem = (name) => items.find((i) => i.Name === name)?.Value;

    const mpesaReceiptNumber = findItem('MpesaReceiptNumber');
    const transactionDate    = findItem('TransactionDate');
    const amountPaid         = findItem('Amount');

    if (!mpesaReceiptNumber) {
      logger.error(
        { event: 'callback_missing_receipt', stkCallback, correlationId },
        'Callback missing MpesaReceiptNumber — cannot credit wallet',
      );
      await markFailed({
        paymentIntentId:   intent.id,
        resultCode:        '-1',
        resultDescription: 'Missing MpesaReceiptNumber in callback',
        callbackPayload:   stkCallback,
        correlationId,
      });
      return { processed: false, reason: 'missing_receipt' };
    }

    // ── 6. VERIFY with Safaricom STK Query ─────────────────────────────────────
    let queryResult;
    try {
      queryResult = await queryStkStatus(checkoutRequestId, correlationId);
    } catch (err) {
      logger.error(
        { event: 'stk_query_error', err, intentId: intent.id, correlationId },
        'STK Query failed — cannot verify payment. Will not credit wallet.',
      );
      // Do NOT credit wallet without verification
      // Intent stays in 'processing' — reconciliation job will retry
      throw new AppError('Payment verification failed. Please contact support if debited.', 502, 'VERIFICATION_FAILED');
    }

    if (queryResult.status !== 'success') {
      logger.warn(
        { event: 'stk_query_mismatch', queryResult, intentId: intent.id, correlationId },
        'STK Query returned non-success after successful callback — marking failed',
      );
      await markFailed({
        paymentIntentId:   intent.id,
        resultCode:        queryResult.resultCode,
        resultDescription: queryResult.resultDesc,
        callbackPayload:   stkCallback,
        correlationId,
      });
      return { processed: true, success: false, reason: 'query_verification_failed' };
    }

    // ── 7. Atomic wallet credit ────────────────────────────────────────────────
    const result = await completePaymentAtomic({
      paymentIntentId:    intent.id,
      mpesaReceiptNumber,
      resultCode,
      resultDescription:  resultDesc,
      callbackPayload:    { ...stkCallback, transactionDate, amountPaid },
      correlationId,
    });

    if (result.duplicate) {
      return { processed: true, duplicate: true };
    }

    return {
      processed:    true,
      success:      true,
      tokensAdded:  result.tokensAdded,
      newBalance:   result.newBalance,
    };
  }

  /**
   * Check the status of a payment intent by ID.
   * Safe to call from client polling.
   */
  async checkPaymentStatus(paymentIntentId, userId) {
    const { data: intent, error } = require('../config/supabase')
      .from('payment_intents')
      .select('id, status, tokens_expected, mpesa_receipt_number, created_at, updated_at')
      .eq('id', paymentIntentId)
      .eq('user_id', userId)  // users can only check their own intents
      .single();

    if (error || !intent) {
      throw new AppError('Payment intent not found', 404, 'NOT_FOUND');
    }

    return intent;
  }
}

module.exports = new PaymentService();