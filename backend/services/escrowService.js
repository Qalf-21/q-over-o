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
}

module.exports = new EscrowService();