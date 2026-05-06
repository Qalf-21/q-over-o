const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

// Tutee dashboard stats
exports.getTuteeStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Sessions booked (all time)
  const { count: totalSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutee_id', userId);

  // Sessions completed
  const { count: completedSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutee_id', userId)
    .eq('status', 'completed');

  // Tokens spent
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount_tokens')
    .eq('user_id', userId)
    .eq('type', 'escrow');

  const totalSpent = transactions?.reduce((sum, t) => sum + t.amount_tokens, 0) || 0;

  // Upcoming sessions
  const { count: upcomingSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutee_id', userId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', new Date().toISOString());

  // Current balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance_tokens')
    .eq('user_id', userId)
    .single();

  res.json({
    success: true,
    data: {
      totalSessions: totalSessions || 0,
      completedSessions: completedSessions || 0,
      upcomingSessions: upcomingSessions || 0,
      totalSpent,
      currentBalance: wallet?.balance_tokens || 0
    }
  });
});