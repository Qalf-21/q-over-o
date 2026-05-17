/**
 * backend/services/escrowService.js  (FULL REPLACEMENT)
 *
 * Atomic Escrow & Wallet Operations for Q-over-o
 * ─────────────────────────────────────────────────────────────────────────────
 * All wallet-mutating operations go through Supabase RPC functions so that
 * balance updates, escrow state changes, and transaction ledger entries are
 * committed atomically — or rolled back together on failure.
 *
 * Escrow states:
 *   locked → released   (session completed → tutor paid)
 *   locked → refunded   (session cancelled → tutee refunded)
 *   locked → disputed   (future: dispute flow)
 */

'use strict';

const supabase                    = require('../config/supabase');
const { AppError }                = require('../utils/errorHandler');
const { auditWallet, auditPayment, logger } = require('../utils/logger');

class EscrowService {
  // ── Lock tokens when session is booked ─────────────────────────────────────

  /**
   * Deduct tokens from tutee's wallet and create an escrow record.
   * Atomic via RPC — rolls back if either step fails.
   *
   * @param {string} sessionId
   * @param {string} payerId    - tutee user ID
   * @param {string} payeeId    - tutor user ID
   * @param {number} amount     - tokens
   * @param {string} correlationId
   */
  async lockTokens(sessionId, payerId, payeeId, amount, correlationId) {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new AppError('Escrow amount must be a positive integer', 400, 'INVALID_AMOUNT');
    }

    const { data, error } = await supabase.rpc('lock_tokens_for_session', {
      p_session_id:      sessionId,
      p_payer_id:        payerId,
      p_payee_id:        payeeId,
      p_amount_tokens:   amount,
      p_correlation_id:  correlationId,
    });

    if (error) {
      logger.error({ event: 'escrow_lock_failed', sessionId, error, correlationId }, 'Escrow lock RPC failed');
      if (error.message?.includes('insufficient_balance')) {
        throw new AppError('Insufficient token balance to book this session', 402, 'INSUFFICIENT_BALANCE');
      }
      throw new AppError(`Escrow lock failed: ${error.message}`, 500, 'ESCROW_LOCK_FAILED');
    }

    auditWallet({
      event: 'escrow_locked',
      sessionId,
      payerId,
      payeeId,
      amount,
      escrowId: data.escrow_id,
      correlationId,
    });

    return data;
  }

  // ── Release tokens to tutor after session completion ───────────────────────

  /**
   * Release escrowed tokens to the tutor's wallet after session completion.
   * Atomic via RPC.
   */
  async releaseTokens(sessionId, correlationId) {
    const { data: escrow, error: fetchErr } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (fetchErr || !escrow) {
      throw new AppError('Escrow record not found', 404, 'ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'locked') {
      throw new AppError(
        `Cannot release escrow in state: ${escrow.status}`,
        409,
        'INVALID_ESCROW_STATE',
      );
    }

    const { data, error } = await supabase.rpc('release_escrow_to_tutor', {
      p_escrow_id:       escrow.id,
      p_session_id:      sessionId,
      p_correlation_id:  correlationId,
    });

    if (error) {
      logger.error({ event: 'escrow_release_failed', sessionId, error, correlationId },
        'Escrow release RPC failed');
      throw new AppError(`Escrow release failed: ${error.message}`, 500, 'ESCROW_RELEASE_FAILED');
    }

    auditWallet({
      event:         'escrow_released',
      sessionId,
      tutorId:       escrow.payee_id,
      amountReleased: escrow.amount_tokens,
      newTutorBalance: data.new_balance,
      correlationId,
    });

    return { success: true, amountReleased: escrow.amount_tokens };
  }

  // ── Refund tokens to tutee on cancellation ─────────────────────────────────

  /**
   * Refund escrowed tokens back to the tutee's wallet.
   * Atomic via RPC.
   */
  async refundTokens(sessionId, correlationId) {
    const { data: escrow, error: fetchErr } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (fetchErr || !escrow) {
      throw new AppError('Escrow record not found', 404, 'ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'locked') {
      throw new AppError(
        `Cannot refund escrow in state: ${escrow.status}`,
        409,
        'INVALID_ESCROW_STATE',
      );
    }

    const { data, error } = await supabase.rpc('refund_escrow_to_tutee', {
      p_escrow_id:       escrow.id,
      p_session_id:      sessionId,
      p_correlation_id:  correlationId,
    });

    if (error) {
      logger.error({ event: 'escrow_refund_failed', sessionId, error, correlationId },
        'Escrow refund RPC failed');
      throw new AppError(`Escrow refund failed: ${error.message}`, 500, 'ESCROW_REFUND_FAILED');
    }

    auditWallet({
      event:           'escrow_refunded',
      sessionId,
      tuteeId:         escrow.payer_id,
      amountRefunded:  escrow.amount_tokens,
      newTuteeBalance: data.new_balance,
      correlationId,
    });

    return { success: true, amountRefunded: escrow.amount_tokens };
  }

  // ── Tutor withdrawal ────────────────────────────────────────────────────────

  /**
   * Process a tutor withdrawal request.
   * Deducts from wallet, creates payout record, and logs the transaction.
   * Actual M-Pesa B2C disbursement is handled separately (payout service).
   */
  async initiateWithdrawal({ tutorId, amountTokens, phoneNumber, correlationId }) {
    if (!Number.isInteger(amountTokens) || amountTokens < 1) {
      throw new AppError('Withdrawal amount must be a positive integer', 400, 'INVALID_AMOUNT');
    }

    const { data, error } = await supabase.rpc('initiate_tutor_withdrawal', {
      p_tutor_id:        tutorId,
      p_amount_tokens:   amountTokens,
      p_phone_number:    phoneNumber,
      p_correlation_id:  correlationId,
    });

    if (error) {
      if (error.message?.includes('insufficient_balance')) {
        throw new AppError('Insufficient balance for withdrawal', 402, 'INSUFFICIENT_BALANCE');
      }
      throw new AppError(`Withdrawal initiation failed: ${error.message}`, 500, 'WITHDRAWAL_FAILED');
    }

    auditWallet({
      event:        'withdrawal_initiated',
      tutorId,
      amountTokens,
      payoutId:     data.payout_id,
      correlationId,
    });

    return data;
  }

  async markWithdrawalProcessing({
    payoutId,
    originatorConversationId,
    conversationId,
    correlationId,
  }) {
    if (!payoutId) return;

    const { error } = await supabase
      .from('payouts')
      .update({
        status: 'processing',
        originator_conversation_id: originatorConversationId,
        conversation_id: conversationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutId);

    if (error) {
      logger.warn(
        { event: 'withdrawal_processing_update_failed', payoutId, error, correlationId },
        'Could not update payout with Daraja B2C tracking fields',
      );
    }
  }

  async findWithdrawalByOriginatorConversationId(originatorConversationId) {
    if (!originatorConversationId) return null;

    const { data, error } = await supabase
      .from('payouts')
      .select('*')
      .eq('originator_conversation_id', originatorConversationId)
      .maybeSingle();

    if (error) {
      logger.warn(
        { event: 'withdrawal_lookup_failed', originatorConversationId, error },
        'Could not look up payout by OriginatorConversationID',
      );
      return null;
    }

    return data;
  }

  async markWithdrawalSucceeded({
    payoutId,
    transactionId,
    resultPayload,
    correlationId,
  }) {
    if (!payoutId) return;

    const { error } = await supabase
      .from('payouts')
      .update({
        status: 'completed',
        mpesa_receipt_number: transactionId,
        result_payload: resultPayload,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutId);

    if (error) {
      logger.warn(
        { event: 'withdrawal_success_update_failed', payoutId, error, correlationId },
        'Could not mark payout completed',
      );
    }
  }

  async refundWithdrawal({
    payoutId,
    tutorId,
    amountTokens,
    reason,
    resultPayload = null,
    correlationId,
  }) {
    if (!tutorId || !Number.isInteger(amountTokens) || amountTokens < 1) {
      logger.error(
        { event: 'withdrawal_refund_invalid_args', payoutId, tutorId, amountTokens, correlationId },
        'Cannot refund withdrawal with invalid arguments',
      );
      return;
    }

    const refundReference = `withdrawal_refund:${payoutId || correlationId}`;
    const { data: existingRefund } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', tutorId)
      .eq('reference', refundReference)
      .maybeSingle();

    if (existingRefund) {
      logger.info(
        { event: 'withdrawal_refund_duplicate_skipped', payoutId, tutorId, correlationId },
        'Withdrawal refund already recorded',
      );
      return;
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', tutorId)
      .maybeSingle();

    if (walletError || !wallet) {
      logger.error(
        { event: 'withdrawal_refund_wallet_missing', payoutId, tutorId, walletError, correlationId },
        'Could not refund withdrawal because wallet was not found',
      );
      return;
    }

    const newBalance = (wallet.balance_tokens || 0) + amountTokens;
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', tutorId);

    if (updateError) {
      logger.error(
        { event: 'withdrawal_refund_wallet_update_failed', payoutId, tutorId, updateError, correlationId },
        'Could not refund withdrawal wallet balance',
      );
      return;
    }

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: tutorId,
        type: 'refund',
        amount_tokens: amountTokens,
        balance_after: newBalance,
        status: 'success',
        reference: refundReference,
        description: `Withdrawal refund: ${reason}`,
        created_at: new Date().toISOString(),
      });

    if (transactionError) {
      logger.warn(
        { event: 'withdrawal_refund_transaction_failed', payoutId, tutorId, transactionError, correlationId },
        'Wallet was refunded but refund transaction logging failed',
      );
    }

    if (payoutId) {
      const { error: payoutError } = await supabase
        .from('payouts')
        .update({
          status: 'failed',
          failure_reason: reason,
          result_payload: resultPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      if (payoutError) {
        logger.warn(
          { event: 'withdrawal_failure_update_failed', payoutId, payoutError, correlationId },
          'Could not mark failed payout after refund',
        );
      }
    }

    auditWallet({
      event: 'withdrawal_refunded',
      tutorId,
      amountTokens,
      payoutId,
      reason,
      correlationId,
    });
  }
}

module.exports = new EscrowService();
