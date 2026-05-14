/**
 * backend/controllers/adminController.js — FULL REPLACEMENT
 *
 * Admin Overview: all metrics fetched from DB, no hardcoded values.
 * Qualification logic:
 *   - qualified: >= 30 session hours, >= 3.0 rating, >= 20 unique student reviewers
 *   - nearQualification: within 5 hrs of hours goal OR within 5 reviews of reviewer goal
 */

'use strict';

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

// ── Helpers ───────────────────────────────────────────────────────────────────

const logAdminAction = async (req, action, targetType, targetId = null, metadata = {}) => {
  await supabase.from('admin_logs').insert({
    admin_id: req.user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
};

const profileName = (profile) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Unknown';

// Parallel count helper — never throws, returns 0 on error
const safeCount = async (table, builder = (q) => q) => {
  try {
    const query = builder(supabase.from(table).select('*', { count: 'exact', head: true }));
    const { count, error } = await query;
    if (error) { console.error(`[safeCount] ${table}:`, error.message); return 0; }
    return count || 0;
  } catch (e) { console.error(`[safeCount] ${table}:`, e.message); return 0; }
};

// ── Tutor qualification thresholds (mirror tutorQualificationService.js) ──────
const MIN_SESSION_HOURS  = 30;
const MIN_RATING         = 3.0;
const MIN_UNIQUE_REVIEWS = 20;
const NEAR_HOURS_DELTA   = 5;   // within 5 hrs = "near qualification"
const NEAR_REVIEWS_DELTA = 5;   // within 5 reviews

// ── Qualification classifier for a single tutor row ──────────────────────────
const classifyTutor = (tp) => {
  const sessionHours   = (tp.total_session_minutes || 0) / 60;
  const avgRating      = Number(tp.rating_avg || 0);
  const uniqueReviewers = tp.unique_reviewer_count || 0;

  const qualifiedHours   = sessionHours   >= MIN_SESSION_HOURS;
  const qualifiedRating  = avgRating      >= MIN_RATING;
  const qualifiedReviews = uniqueReviewers >= MIN_UNIQUE_REVIEWS;
  const qualified        = qualifiedHours && qualifiedRating && qualifiedReviews;

  const hoursRemaining   = Math.max(0, MIN_SESSION_HOURS   - sessionHours);
  const reviewsRemaining = Math.max(0, MIN_UNIQUE_REVIEWS  - uniqueReviewers);

  const nearQualification = !qualified && (
    hoursRemaining   <= NEAR_HOURS_DELTA ||
    reviewsRemaining <= NEAR_REVIEWS_DELTA
  );

  return { qualified, nearQualification };
};

// ── getAdminOverview ──────────────────────────────────────────────────────────
exports.getAdminOverview = asyncHandler(async (req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Parallel independent counts ───────────────────────────────────────────
  const [
    totalUsers,
    totalTutors,
    totalTutees,
    activeSessions,
    completedSessions,
    cancelledSessions,
    newUsersThisWeek,
  ] = await Promise.all([
    safeCount('profiles'),
    safeCount('tutor_profiles'),
    safeCount('profiles', (q) => q.eq('role', 'tutee')),
    safeCount('sessions', (q) => q.in('status', ['pending', 'confirmed'])),
    safeCount('sessions', (q) => q.eq('status', 'completed')),
    safeCount('sessions', (q) => q.eq('status', 'cancelled')),
    safeCount('profiles', (q) => q.gte('created_at', oneWeekAgo)),
  ]);

  // ── Revenue: sum of completed payment_intents (KES) ──────────────────────
  const { data: revenueData, error: revenueError } = await supabase
    .from('payment_intents')
    .select('amount_kes')
    .eq('status', 'completed');

  const revenueKes = revenueError
    ? 0
    : (revenueData || []).reduce((s, r) => s + (r.amount_kes || 0), 0);

  // ── Tokens purchased (all successful payment_intents) ─────────────────────
  const { data: tokenData, error: tokenError } = await supabase
    .from('payment_intents')
    .select('tokens_expected')
    .eq('status', 'completed');

  const tokensPurchased = tokenError
    ? 0
    : (tokenData || []).reduce((s, r) => s + (r.tokens_expected || 0), 0);

  // ── Tokens in escrow: sum of escrow transactions minus releases ──────────
  const { data: escrowData, error: escrowError } = await supabase
    .from('transactions')
    .select('amount_tokens, type')
    .in('type', ['escrow', 'escrow_release', 'refund']);

  let tokensInEscrow = 0;
  if (!escrowError && escrowData) {
    tokensInEscrow = escrowData.reduce((s, t) => {
      if (t.type === 'escrow')         return s + (t.amount_tokens || 0);
      if (t.type === 'escrow_release') return s - (t.amount_tokens || 0);
      if (t.type === 'refund')         return s - (t.amount_tokens || 0);
      return s;
    }, 0);
    tokensInEscrow = Math.max(0, tokensInEscrow);
  }

  // ── Active tutors (is_available = true) ───────────────────────────────────
  const activeTutors = await safeCount('tutor_profiles', (q) => q.eq('is_available', true));

  // ── Qualification stats: need per-tutor data ──────────────────────────────
  const { data: tutorProfiles, error: tpError } = await supabase
    .from('tutor_profiles')
    .select('user_id, rating_avg, total_reviews, total_session_minutes, unique_reviewer_count');

  let qualifiedTutors = 0;
  let tutorsNearQualification = 0;

  if (!tpError && tutorProfiles) {
    for (const tp of tutorProfiles) {
      const { qualified, nearQualification } = classifyTutor(tp);
      if (qualified)          qualifiedTutors++;
      if (nearQualification)  tutorsNearQualification++;
    }
  }

  // ── Chart data: sessions over time (last 30 days, daily) ─────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessionsTimeline } = await supabase
    .from('sessions')
    .select('created_at, status')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // ── Chart data: revenue over time (last 30 days, daily) ──────────────────
  const { data: revenueTimeline } = await supabase
    .from('payment_intents')
    .select('created_at, amount_kes, tokens_expected')
    .eq('status', 'completed')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // ── Chart data: user growth (last 30 days) ───────────────────────────────
  const { data: userGrowth } = await supabase
    .from('profiles')
    .select('created_at, role')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // ── Chart data: token purchases (last 30 days) ───────────────────────────
  const { data: tokenPurchases } = await supabase
    .from('payment_intents')
    .select('created_at, tokens_expected, amount_kes')
    .eq('status', 'completed')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // ── Tables: recent users ──────────────────────────────────────────────────
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Tables: recent sessions ───────────────────────────────────────────────
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select(`
      id, status, start_time, end_time, token_amount, amount_tokens, cost_tokens, created_at,
      tutor:tutor_id ( first_name, last_name ),
      tutee:tutee_id ( first_name, last_name )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Tables: recent payments ───────────────────────────────────────────────
  const { data: recentPayments } = await supabase
    .from('payment_intents')
    .select(`
      id, status, amount_kes, tokens_expected, created_at, completed_at,
      profiles:user_id ( first_name, last_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Tables: flagged reviews (low rating = 1 or 2) ────────────────────────
  const { data: flaggedReviews } = await supabase
    .from('reviews')
    .select(`
      id, rating, comment, reviewee_role, created_at,
      reviewer:reviewer_id ( first_name, last_name ),
      reviewee:reviewee_id ( first_name, last_name )
    `)
    .lte('rating', 2)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Qualification detail list (for a tutor progress table) ───────────────
  const qualificationList = (tutorProfiles || []).map((tp) => {
    const sessionHours    = (tp.total_session_minutes || 0) / 60;
    const avgRating       = Number(tp.rating_avg || 0);
    const uniqueReviewers = tp.unique_reviewer_count || 0;

    const { qualified, nearQualification } = classifyTutor(tp);

    const hoursRemaining   = Math.max(0, MIN_SESSION_HOURS  - sessionHours);
    const reviewsRemaining = Math.max(0, MIN_UNIQUE_REVIEWS - uniqueReviewers);
    const ratingOk         = avgRating >= MIN_RATING;

    // Progress percentage (average of three criteria, capped at 100)
    const pctHours   = Math.min(100, (sessionHours    / MIN_SESSION_HOURS)   * 100);
    const pctReviews = Math.min(100, (uniqueReviewers / MIN_UNIQUE_REVIEWS) * 100);
    const pctRating  = ratingOk ? 100 : Math.min(100, (avgRating / MIN_RATING) * 100);
    const progress   = Math.round((pctHours + pctReviews + pctRating) / 3);

    return {
      tutorId: tp.user_id,
      sessionHours: Math.round(sessionHours * 10) / 10,
      averageRating: Math.round(avgRating * 10) / 10,
      uniqueReviewers,
      qualified,
      nearQualification,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      reviewsRemaining,
      ratingOk,
      progress,
    };
  });

  // ── Log admin action ──────────────────────────────────────────────────────
  await logAdminAction(req, 'admin.overview.view', 'dashboard');

  res.json({
    success: true,
    data: {
      metrics: {
        totalUsers,
        totalTutors,
        totalTutees,
        activeSessions,
        completedSessions,
        cancelledSessions,
        revenueKes,
        tokensPurchased,
        tokensInEscrow,
        activeTutors,
        qualifiedTutors,
        tutorsNearQualification,
        newUsersThisWeek,
      },
      charts: {
        sessionsTimeline: sessionsTimeline || [],
        revenueTimeline:  revenueTimeline  || [],
        userGrowth:       userGrowth       || [],
        tokenPurchases:   tokenPurchases   || [],
      },
      tables: {
        recentUsers:    recentUsers    || [],
        recentSessions: recentSessions || [],
        recentPayments: recentPayments || [],
        flaggedReviews: flaggedReviews || [],
      },
      qualification: {
        thresholds: {
          minSessionHours:  MIN_SESSION_HOURS,
          minRating:        MIN_RATING,
          minUniqueReviews: MIN_UNIQUE_REVIEWS,
        },
        list: qualificationList,
      },
    },
  });
});

// ── Keep existing section endpoints (unchanged) ───────────────────────────────

exports.getOverview = asyncHandler(async (req, res) => {
  // Legacy thin overview — kept for backwards compat
  const [users, tutors, sessions, wallets, reviews] = await Promise.all([
    safeCount('profiles'),
    safeCount('tutor_profiles'),
    safeCount('sessions'),
    safeCount('wallets'),
    safeCount('reviews', (q) => q.is('deleted_at', null)),
  ]);

  const { data: recentLogs } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8);

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
    data: (data || []).map((user) => ({
      id:        user.id,
      title:     profileName(user),
      subtitle:  user.email,
      status:    user.role || 'tutee',
      metadata:  user.id,
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
    data: (data || []).map((tutor) => ({
      id:        tutor.user_id,
      title:     profileName(tutor.profiles),
      subtitle:  tutor.profiles?.email || tutor.user_id,
      status:    tutor.is_available ? 'available' : 'unavailable',
      metadata:  `${tutor.hourly_rate_tokens || 0} tokens/hr | ${Number(tutor.rating_avg || 0).toFixed(1)} rating`,
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
    data: (data || []).map((session) => ({
      id:        session.id,
      title:     `Session ${session.id}`,
      subtitle:  `${new Date(session.start_time).toLocaleString()} - ${new Date(session.end_time).toLocaleTimeString()}`,
      status:    session.status,
      metadata:  `${session.token_amount ?? session.amount_tokens ?? session.cost_tokens ?? 0} tokens`,
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
    data: (data || []).map((wallet) => ({
      id:        wallet.user_id,
      title:     profileName(wallet.profiles),
      subtitle:  wallet.profiles?.email || wallet.user_id,
      status:    'active',
      metadata:  `${wallet.balance_tokens || 0} tokens`,
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
    data: (data || []).map((review) => ({
      id:        review.id,
      title:     `${review.rating}/5 ${review.reviewee_role} review`,
      subtitle:  review.comment || 'No comment',
      status:    'published',
      metadata:  review.id,
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