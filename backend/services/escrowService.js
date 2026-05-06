const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');

class EscrowService {
  /**
   * Lock tokens in escrow when booking is created
   */
  async lockTokens(sessionId, payerId, payeeId, amount) {
    const { data, error } = await supabase
      .from('escrow')
      .insert({
        session_id: sessionId,
        payer_id: payerId,
        payee_id: payeeId,
        amount_tokens: amount,
        status: 'locked'
      })
      .select()
      .single();

    if (error) throw new AppError(`Escrow lock failed: ${error.message}`, 500);
    return data;
  }

  /**
   * Release tokens to tutor after session completion
   */
  async releaseTokens(sessionId) {
    // Get escrow record
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (escrowError || !escrow) {
      throw new AppError('Escrow record not found', 404);
    }

    if (escrow.status !== 'locked') {
      throw new AppError('Escrow is not in locked state', 400);
    }

    // Update escrow status
    const { error: updateError } = await supabase
      .from('escrow')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', escrow.id);

    if (updateError) throw new AppError('Failed to release escrow', 500);

    // Credit tutor's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', escrow.payee_id)
      .single();

    if (walletError) throw new AppError('Tutor wallet not found', 404);

    const newBalance = wallet.balance_tokens + escrow.amount_tokens;

    const { error: creditError } = await supabase
      .from('wallets')
      .update({ balance_tokens: newBalance })
      .eq('user_id', escrow.payee_id);

    if (creditError) throw new AppError('Failed to credit tutor wallet', 500);

    // Log transaction for tutor
    await supabase.from('transactions').insert({
      user_id: escrow.payee_id,
      type: 'credit',
      amount_tokens: escrow.amount_tokens,
      balance_before: wallet.balance_tokens,
      balance_after: newBalance,
      status: 'completed',
      reference: `session-${sessionId}`,
      session_id: sessionId
    });

    return { success: true, amountReleased: escrow.amount_tokens };
  }

  /**
   * Refund tokens to tutee if session is cancelled
   */
  async refundTokens(sessionId) {
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (escrowError || !escrow) {
      throw new AppError('Escrow record not found', 404);
    }

    if (escrow.status !== 'locked') {
      throw new AppError('Escrow is not in locked state', 400);
    }

    // Update escrow status
    const { error: updateError } = await supabase
      .from('escrow')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', escrow.id);

    if (updateError) throw new AppError('Failed to update escrow', 500);

    // Refund tutee's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_tokens')
      .eq('user_id', escrow.payer_id)
      .single();

    if (walletError) throw new AppError('Tutee wallet not found', 404);

    const newBalance = wallet.balance_tokens + escrow.amount_tokens;

    const { error: refundError } = await supabase
      .from('wallets')
      .update({ balance_tokens: newBalance })
      .eq('user_id', escrow.payer_id);

    if (refundError) throw new AppError('Failed to refund wallet', 500);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: escrow.payer_id,
      type: 'refund',
      amount_tokens: escrow.amount_tokens,
      balance_before: wallet.balance_tokens,
      balance_after: newBalance,
      status: 'completed',
      reference: `refund-${sessionId}`,
      session_id: sessionId
    });

    return { success: true, amountRefunded: escrow.amount_tokens };
  }
}

module.exports = new EscrowService();