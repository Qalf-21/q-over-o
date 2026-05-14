const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

const logAdminAction = async (req, action, targetType, targetId = null, metadata = {}) => {
  await supabase.from('admin_logs').insert({
    admin_id: req.user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
};

const countRows = async (table, builder = query => query) => {
  const query = builder(supabase.from(table).select('*', { count: 'exact', head: true }));
  const { count, error } = await query;
  if (error) throw new AppError(`Failed to count ${table}`, 500);
  return count || 0;
};

const profileName = (profile) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Unknown';

exports.getOverview = asyncHandler(async (req, res) => {
  const [users, tutors, sessions, wallets, reviews] = await Promise.all([
    countRows('profiles'),
    countRows('tutor_profiles'),
    countRows('sessions'),
    countRows('wallets'),
    countRows('reviews', query => query.is('deleted_at', null)),
  ]);

  const { data: recentLogs, error: logsError } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8);

  if (logsError) throw new AppError('Failed to fetch admin logs', 500);

  await logAdminAction(req, 'admin.overview.view', 'dashboard');

  res.json({
    success: true,
    data: {
      totals: { users, tutors, sessions, wallets, reviews },
      recentLogs: recentLogs || [],
    },
  });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch users', 500);

  res.json({
    success: true,
    data: (data || []).map(user => ({
      id: user.id,
      title: profileName(user),
      subtitle: user.email,
      status: user.role || 'tutee',
      metadata: user.id,
      createdAt: user.created_at,
    })),
  });
});

exports.getTutors = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select('user_id, hourly_rate_tokens, rating_avg, is_available, created_at, profiles:user_id(email, first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch tutors', 500);

  res.json({
    success: true,
    data: (data || []).map(tutor => ({
      id: tutor.user_id,
      title: profileName(tutor.profiles),
      subtitle: tutor.profiles?.email || tutor.user_id,
      status: tutor.is_available ? 'available' : 'unavailable',
      metadata: `${tutor.hourly_rate_tokens || 0} tokens/hr | ${Number(tutor.rating_avg || 0).toFixed(1)} rating`,
      createdAt: tutor.created_at,
    })),
  });
});

exports.getSessions = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, status, start_time, end_time, token_amount, amount_tokens, cost_tokens, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch sessions', 500);

  res.json({
    success: true,
    data: (data || []).map(session => ({
      id: session.id,
      title: `Session ${session.id}`,
      subtitle: `${new Date(session.start_time).toLocaleString()} - ${new Date(session.end_time).toLocaleTimeString()}`,
      status: session.status,
      metadata: `${session.token_amount ?? session.amount_tokens ?? session.cost_tokens ?? 0} tokens`,
      createdAt: session.created_at,
    })),
  });
});

exports.getWallets = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id, balance_tokens, updated_at, profiles:user_id(email, first_name, last_name)')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch wallets', 500);

  res.json({
    success: true,
    data: (data || []).map(wallet => ({
      id: wallet.user_id,
      title: profileName(wallet.profiles),
      subtitle: wallet.profiles?.email || wallet.user_id,
      status: 'active',
      metadata: `${wallet.balance_tokens || 0} tokens`,
      createdAt: wallet.updated_at,
    })),
  });
});

exports.getReviews = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, reviewee_role, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch reviews', 500);

  res.json({
    success: true,
    data: (data || []).map(review => ({
      id: review.id,
      title: `${review.rating}/5 ${review.reviewee_role} review`,
      subtitle: review.comment || 'No comment',
      status: 'published',
      metadata: review.id,
      createdAt: review.created_at,
    })),
  });
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch admin logs', 500);
  res.json({ success: true, data: data || [] });
});
