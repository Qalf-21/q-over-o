// backend/controllers/walletController.js — getBalance PATCHED
//
// Change: getBalance now auto-creates a zero-balance wallet if none exists
// instead of throwing 404. This is a safety net for users who registered
// before the wallet-creation fix was added to authController.register().

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const paymentService = require('../services/paymentService');

exports.getBalance = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let { data: wallet, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  // ── Auto-create wallet if missing (lazy safety net) ─────────────────────────
  if (error || !wallet) {
    const { data: created, error: createError } = await supabase
      .from('wallets')
      .upsert({ user_id: userId, balance_tokens: 0 }, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (createError || !created) {
      throw new AppError('Wallet not found and could not be created', 500);
    }
    wallet = created;
  }

  const { data: transactions, error: transactionError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (transactionError) throw new AppError('Failed to fetch transactions', 500);

  res.json({
    success: true,
    data: {
      ...wallet,
      transactions: transactions || []
    }
  });
});

exports.getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to fetch transactions', 500);

  res.json({
    success: true,
    data: transactions
  });
});

exports.purchaseTokens = asyncHandler(async (req, res) => {
  const { amountKes, phoneNumber } = req.body;
  const userId = req.user.id;

  if (!amountKes || !phoneNumber) {
    throw new AppError('Amount and phone number are required', 400);
  }

  const tokensExpected = Math.floor(amountKes * 0.5);

  const paymentIntent = await paymentService.createPaymentIntent(
    userId,
    amountKes,
    tokensExpected
  );

  const stkResponse = await paymentService.initiateSTKPush(
    phoneNumber,
    amountKes,
    `QOVERO-${paymentIntent.id}`
  );

  await supabase
    .from('payment_intents')
    .update({ mpesa_reference: stkResponse.checkoutRequestID })
    .eq('id', paymentIntent.id);

  res.json({
    success: true,
    message: 'Payment initiated. Check your phone for M-Pesa prompt.',
    data: {
      paymentIntentId: paymentIntent.id,
      checkoutRequestId: stkResponse.checkoutRequestID,
      tokensExpected
    }
  });
});

exports.handleMpesaCallback = asyncHandler(async (req, res) => {
  const callbackData = req.body;
  console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));
  const result = await paymentService.handleCallback(callbackData);
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

exports.getSpending = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to fetch spending', 500);

  const totalSpent = transactions
    .filter(t => ['escrow', 'purchase'].includes(t.type))
    .reduce((sum, t) => sum + t.amount_tokens, 0);

  res.json({
    success: true,
    data: {
      totalSpent,
      transactions
    }
  });
});

// Tutor withdrawal
exports.withdraw = asyncHandler(async (req, res) => {
  const { amount, phoneNumber, payoutMethod = 'mpesa' } = req.body;
  const userId = req.user.id;

  if (req.user.role !== 'tutor') {
    throw new AppError('Only tutors can withdraw earnings', 403);
  }

  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 100) {
    throw new AppError('Minimum withdrawal is 100 tokens', 400);
  }

  if (!phoneNumber) {
    throw new AppError('phoneNumber is required', 400);
  }

  const { data, error } = await supabase.rpc('request_withdrawal_atomic', {
    p_user_id: userId,
    p_amount_tokens: Number(amount),
    p_payout_method: payoutMethod,
    p_payout_reference: phoneNumber
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.json({
    success: true,
    message: 'Withdrawal request submitted for review',
    data
  });
});
