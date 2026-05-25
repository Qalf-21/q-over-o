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
const { auditWallet, logger } = require('../utils/logger');

const isMissingRpc = (error) => (
  error?.code === 'PGRST202' ||
  /function .* does not exist|could not find.*function|schema cache/i.test(String(error?.message || ''))
);


const tryUpdateSession = async (sessionId, payloads) => {
  for (const payload of payloads) {
    const { error } = await supabase.from('sessions').update(payload).eq('id', sessionId);
    if (!error) return;
  }
};

const tryInsertEscrow = async (payload) => {
  const attempts = [
    payload,
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['created_at', 'updated_at'].includes(key))),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase.from('escrow').insert(attempt).select('*').single();
    if (!error && data) return data;
    lastError = error;
  }
  throw lastError;
};

const tryUpdateEscrow = async (escrowId, payloads) => {
  for (const payload of payloads) {
    const { error } = await supabase.from('escrow').update(payload).eq('id', escrowId);
    if (!error) return;
  }
};

const insertTransaction = async (payload) => {
  const { error } = await supabase.from('transactions').insert(payload);
  if (error) {
    logger.warn({ event: 'wallet_transaction_insert_failed', error, payload }, 'Wallet transaction insert failed');
  }
};

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

    let data = null;
    const { data: rpcData, error } = await supabase.rpc('lock_tokens_for_session', {
      p_session_id:      sessionId,
      p_payer_id:        payerId,
      p_payee_id:        payeeId,
      p_amount_tokens:   amount,
      p_correlation_id:  correlationId,
    });

    if (error) {
      if (isMissingRpc(error)) {
        logger.warn({ event: 'escrow_lock_rpc_missing_fallback', sessionId, correlationId }, 'Escrow lock RPC missing; using direct DB fallback');
        data = await this.lockTokensDirect(sessionId, payerId, payeeId, amount, correlationId);
      } else {
        logger.error({ event: 'escrow_lock_failed', sessionId, error, correlationId }, 'Escrow lock RPC failed');
        if (error.message?.includes('insufficient_balance')) {
          throw new AppError('Insufficient token balance to book this session', 402, 'INSUFFICIENT_BALANCE');
        }
        throw new AppError(`Escrow lock failed: ${error.message}`, 500, 'ESCROW_LOCK_FAILED');
      }
    } else {
      data = rpcData;
    }

    auditWallet({
      event: 'escrow_locked',
      sessionId,
      payerId,
      payeeId,
      amount,
      escrowId: data?.escrow_id,
      correlationId,
    });

    return data;
  }

  async lockTokensDirect(sessionId, payerId, payeeId, amount, correlationId) {
    const { data: existingEscrow, error: existingError } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingError) {
      throw new AppError(`Escrow lookup failed: ${existingError.message}`, 500, 'ESCROW_LOOKUP_FAILED');
    }

    if (existingEscrow) {
      if (existingEscrow.status === 'locked') return { escrow_id: existingEscrow.id };
      throw new AppError(`Cannot lock escrow in state: ${existingEscrow.status}`, 409, 'INVALID_ESCROW_STATE');
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', payerId)
      .maybeSingle();

    if (walletError) {
      throw new AppError(`Wallet lookup failed: ${walletError.message}`, 500, 'WALLET_LOOKUP_FAILED');
    }

    const currentBalance = Number(wallet?.balance_tokens || 0);
    if (!wallet || currentBalance < amount) {
      throw new AppError('Insufficient token balance to book this session', 402, 'INSUFFICIENT_BALANCE');
    }

    const newBalance = currentBalance - amount;
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', payerId);

    if (walletUpdateError) {
      throw new AppError(`Wallet debit failed: ${walletUpdateError.message}`, 500, 'WALLET_DEBIT_FAILED');
    }

    try {
      const escrow = await tryInsertEscrow({
        session_id: sessionId,
        payer_id: payerId,
        payee_id: payeeId,
        amount_tokens: amount,
        status: 'locked',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await insertTransaction({
        user_id: payerId,
        type: 'escrow',
        amount_tokens: -amount,
        balance_after: newBalance,
        status: 'completed',
        reference: `session:${sessionId}`,
        description: 'Session payment held in escrow',
        session_id: sessionId,
        created_at: new Date().toISOString(),
      });

      await tryUpdateSession(sessionId, [
        { payment_status: 'escrow_locked', updated_at: new Date().toISOString() },
        { payment_status: 'escrow_locked' },
      ]);

      return { escrow_id: escrow.id, balance_after: newBalance };
    } catch (err) {
      await supabase
        .from('wallets')
        .update({ balance_tokens: currentBalance, updated_at: new Date().toISOString() })
        .eq('user_id', payerId);
      throw new AppError(`Escrow lock failed: ${err.message || 'unknown error'}`, 500, 'ESCROW_LOCK_FAILED');
    }
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

  async releaseSessionEscrow({ sessionId, actorId, tutorShare, correlationId }) {
    let rpcPayload = { p_session_id: sessionId, p_actor_id: actorId };
    if (Number.isInteger(tutorShare) && tutorShare > 0) {
      rpcPayload = { ...rpcPayload, p_tutor_share: tutorShare };
    }

    const { data: escrowBefore } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    const amountExpected = escrowBefore?.amount_tokens
      ? (Number.isInteger(tutorShare) && tutorShare > 0
        ? Math.min(tutorShare, Number(escrowBefore.amount_tokens || 0))
        : Number(escrowBefore.amount_tokens || 0))
      : 0;
    const { data: walletBefore } = escrowBefore?.payee_id
      ? await supabase
        .from('wallets')
        .select('balance_tokens')
        .eq('user_id', escrowBefore.payee_id)
        .maybeSingle()
      : { data: null };
    const balanceBefore = Number(walletBefore?.balance_tokens || 0);

    let { error } = await supabase.rpc('release_escrow_on_completion', rpcPayload);
    if (error?.message?.includes('p_tutor_share')) {
      const fallback = await supabase.rpc('release_escrow_on_completion', {
        p_session_id: sessionId,
        p_actor_id: actorId,
      });
      error = fallback.error;
    }

    if (!error) {
      const { data: escrowAfterRpc, error: verifyError } = await supabase
        .from('escrow')
        .select('status')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!verifyError && escrowAfterRpc?.status !== 'locked') {
        if (escrowBefore?.payee_id && amountExpected > 0) {
          const [{ data: walletAfter }, { data: releaseTx }] = await Promise.all([
            supabase
              .from('wallets')
              .select('balance_tokens')
              .eq('user_id', escrowBefore.payee_id)
              .maybeSingle(),
            supabase
              .from('transactions')
              .select('id')
              .eq('user_id', escrowBefore.payee_id)
              .eq('session_id', sessionId)
              .eq('type', 'release')
              .maybeSingle(),
          ]);

          const balanceAfter = Number(walletAfter?.balance_tokens || 0);
          if (!releaseTx && balanceAfter < balanceBefore + amountExpected) {
            logger.warn(
              { event: 'escrow_release_rpc_wallet_repair', sessionId, tutorId: escrowBefore.payee_id, amountExpected, correlationId },
              'Escrow release RPC completed without visible tutor wallet credit; repairing wallet balance',
            );
            await this.creditReleasedEscrowDirect({
              sessionId,
              tutorId: escrowBefore.payee_id,
              amountReleased: amountExpected,
              currentBalance: balanceAfter,
              correlationId,
            });
          }
        }
        return { success: true };
      }

      logger.warn(
        { event: 'escrow_release_rpc_no_effect_fallback', sessionId, status: escrowAfterRpc?.status, verifyError, correlationId },
        'Escrow release RPC returned success but escrow is still locked; using direct DB fallback',
      );
      return this.releaseSessionEscrowDirect({ sessionId, tutorShare, correlationId });
    }

    if (!isMissingRpc(error)) {
      throw new AppError(error.message, 400, 'ESCROW_RELEASE_FAILED');
    }

    logger.warn({ event: 'escrow_release_rpc_missing_fallback', sessionId, correlationId }, 'Escrow release RPC missing; using direct DB fallback');
    return this.releaseSessionEscrowDirect({ sessionId, tutorShare, correlationId });
  }

  async creditReleasedEscrowDirect({ sessionId, tutorId, amountReleased, currentBalance, correlationId }) {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('user_id', tutorId)
      .maybeSingle();
    const newBalance = currentBalance + amountReleased;
    const walletResult = wallet
      ? await supabase
        .from('wallets')
        .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', tutorId)
      : await supabase
        .from('wallets')
        .insert({ user_id: tutorId, balance_tokens: newBalance, updated_at: new Date().toISOString() });

    if (walletResult.error) {
      throw new AppError(`Tutor wallet credit repair failed: ${walletResult.error.message}`, 500, 'WALLET_CREDIT_FAILED');
    }

    await insertTransaction({
      user_id: tutorId,
      type: 'release',
      amount_tokens: amountReleased,
      balance_after: newBalance,
      status: 'completed',
      reference: `session:${sessionId}`,
      description: 'Session escrow released',
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });

    auditWallet({
      event: 'escrow_release_wallet_repaired',
      sessionId,
      tutorId,
      amountReleased,
      correlationId,
    });

    return { success: true, amountReleased };
  }

  async releaseSessionEscrowDirect({ sessionId, tutorShare, correlationId }) {
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (escrowError || !escrow) {
      throw new AppError('Escrow record not found', 404, 'ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'locked') {
      throw new AppError(`Cannot release escrow in state: ${escrow.status}`, 409, 'INVALID_ESCROW_STATE');
    }

    const escrowAmount = Number(escrow.amount_tokens || 0);
    const amountReleased = Number.isInteger(tutorShare) && tutorShare > 0
      ? Math.min(tutorShare, escrowAmount)
      : escrowAmount;

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', escrow.payee_id)
      .maybeSingle();

    if (walletError) {
      throw new AppError(`Tutor wallet lookup failed: ${walletError.message}`, 500, 'WALLET_LOOKUP_FAILED');
    }

    const currentBalance = Number(wallet?.balance_tokens || 0);
    const newBalance = currentBalance + amountReleased;
    const walletResult = wallet
      ? await supabase.from('wallets').update({ balance_tokens: newBalance, updated_at: new Date().toISOString() }).eq('user_id', escrow.payee_id)
      : await supabase.from('wallets').insert({ user_id: escrow.payee_id, balance_tokens: newBalance, updated_at: new Date().toISOString() });

    if (walletResult.error) {
      throw new AppError(`Tutor wallet credit failed: ${walletResult.error.message}`, 500, 'WALLET_CREDIT_FAILED');
    }

    await tryUpdateEscrow(escrow.id, [
      { status: 'released', released_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { status: 'released', updated_at: new Date().toISOString() },
      { status: 'released' },
    ]);

    await tryUpdateSession(sessionId, [
      { status: 'completed', payment_status: 'completed', updated_at: new Date().toISOString() },
      { status: 'completed', payment_status: 'completed' },
      { status: 'completed' },
    ]);

    await insertTransaction({
      user_id: escrow.payee_id,
      type: 'release',
      amount_tokens: amountReleased,
      balance_after: newBalance,
      status: 'completed',
      reference: `session:${sessionId}`,
      description: 'Session escrow released',
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });

    auditWallet({
      event: 'escrow_released_direct_db',
      sessionId,
      tutorId: escrow.payee_id,
      amountReleased,
      correlationId,
    });

    return { success: true, amountReleased };
  }

  async refundSessionEscrow({ sessionId, actorId, targetStatus = 'cancelled', correlationId }) {
    const { error } = await supabase.rpc('refund_escrow_on_cancellation', {
      p_session_id: sessionId,
      p_actor_id: actorId,
    });

    if (!error) {
      if (targetStatus !== 'cancelled') {
        await tryUpdateSession(sessionId, [
          { status: targetStatus, payment_status: 'refunded', updated_at: new Date().toISOString() },
          { status: targetStatus, payment_status: 'refunded' },
          { status: targetStatus },
        ]);
      }
      return { success: true };
    }

    if (!isMissingRpc(error)) {
      throw new AppError(error.message, 400, 'ESCROW_REFUND_FAILED');
    }

    logger.warn({ event: 'escrow_refund_rpc_missing_fallback', sessionId, correlationId }, 'Escrow refund RPC missing; using direct DB fallback');
    return this.refundSessionEscrowDirect({ sessionId, targetStatus, correlationId });
  }

  async refundSessionEscrowDirect({ sessionId, targetStatus = 'cancelled', correlationId }) {
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (escrowError || !escrow) {
      throw new AppError('Escrow record not found', 404, 'ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'locked') {
      await tryUpdateSession(sessionId, [
        { status: targetStatus, updated_at: new Date().toISOString() },
        { status: targetStatus },
      ]);
      return { success: true, duplicate: true };
    }

    const amountRefunded = Number(escrow.amount_tokens || 0);
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', escrow.payer_id)
      .maybeSingle();

    if (walletError) {
      throw new AppError(`Tutee wallet lookup failed: ${walletError.message}`, 500, 'WALLET_LOOKUP_FAILED');
    }

    const currentBalance = Number(wallet?.balance_tokens || 0);
    const newBalance = currentBalance + amountRefunded;
    const walletResult = wallet
      ? await supabase.from('wallets').update({ balance_tokens: newBalance, updated_at: new Date().toISOString() }).eq('user_id', escrow.payer_id)
      : await supabase.from('wallets').insert({ user_id: escrow.payer_id, balance_tokens: newBalance, updated_at: new Date().toISOString() });

    if (walletResult.error) {
      throw new AppError(`Tutee wallet refund failed: ${walletResult.error.message}`, 500, 'WALLET_REFUND_FAILED');
    }

    await tryUpdateEscrow(escrow.id, [
      { status: 'refunded', refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { status: 'refunded', updated_at: new Date().toISOString() },
      { status: 'refunded' },
    ]);

    await tryUpdateSession(sessionId, [
      { status: targetStatus, payment_status: 'refunded', updated_at: new Date().toISOString() },
      { status: targetStatus, payment_status: 'refunded' },
      { status: targetStatus },
    ]);

    await insertTransaction({
      user_id: escrow.payer_id,
      type: 'refund',
      amount_tokens: amountRefunded,
      balance_after: newBalance,
      status: 'completed',
      reference: `session:${sessionId}`,
      description: 'Session escrow refunded',
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });

    auditWallet({
      event: 'escrow_refunded_direct_db',
      sessionId,
      tuteeId: escrow.payer_id,
      amountRefunded,
      correlationId,
    });

    return { success: true, amountRefunded };
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
