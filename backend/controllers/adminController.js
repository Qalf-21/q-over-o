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
const escrowService = require('../services/escrowService');

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

const cleanSubjectName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const subjectCodeFromName = (name) =>
  cleanSubjectName(name)
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 12)
    .toUpperCase() || null;

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

const roundOne = (value) => Math.round(value * 10) / 10;

const hoursBetween = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return (endMs - startMs) / 36e5;
};

const sessionTokenAmount = (session) =>
  session?.token_amount ?? session?.amount_tokens ?? session?.cost_tokens ?? 0;

// ── Qualification classifier for a single tutor row ──────────────────────────
const classifyTutor = ({ sessionHours = 0, averageRating = 0, uniqueReviewers = 0 }) => {
  const avgRating = Number(averageRating || 0);

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

const pageParams = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
};

const parseBooleanFilter = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

const sumBy = (rows, key, valueKey) => {
  const map = new Map();
  (rows || []).forEach((row) => map.set(row[key], (map.get(row[key]) || 0) + Number(row[valueKey] || 0)));
  return map;
};

const getQualificationStatus = ({ sessionHours, averageRating, uniqueReviewers }) => {
  if (sessionHours >= MIN_SESSION_HOURS && uniqueReviewers >= MIN_UNIQUE_REVIEWS && averageRating >= MIN_RATING) {
    return 'Qualified';
  }
  if (sessionHours < MIN_SESSION_HOURS) return 'Pending Hours';
  if (uniqueReviewers < MIN_UNIQUE_REVIEWS) return 'Pending Reviews';
  return 'Pending Rating';
};

const getUserRollups = async (userIds) => {
  if (!userIds.length) {
    return { wallets: new Map(), sessionCounts: new Map(), reviewCounts: new Map(), spending: new Map(), earnings: new Map() };
  }

  const [walletRes, sessionsRes, reviewsRes, spendingRes, earningsRes] = await Promise.all([
    supabase.from('wallets').select('user_id, balance_tokens').in('user_id', userIds),
    supabase.from('sessions').select('tutee_id, tutor_id').or(`tutee_id.in.(${userIds.join(',')}),tutor_id.in.(${userIds.join(',')})`),
    supabase.from('reviews').select('reviewer_id, reviewee_id').is('deleted_at', null).or(`reviewer_id.in.(${userIds.join(',')}),reviewee_id.in.(${userIds.join(',')})`),
    supabase.from('transactions').select('user_id, amount_tokens').in('user_id', userIds).lt('amount_tokens', 0),
    supabase.from('transactions').select('user_id, amount_tokens').in('user_id', userIds).gt('amount_tokens', 0),
  ]);

  return {
    wallets: new Map((walletRes.data || []).map((wallet) => [wallet.user_id, wallet])),
    sessionCounts: (sessionsRes.data || []).reduce((map, session) => {
      [session.tutee_id, session.tutor_id].forEach((id) => {
        if (id && userIds.includes(id)) map.set(id, (map.get(id) || 0) + 1);
      });
      return map;
    }, new Map()),
    reviewCounts: (reviewsRes.data || []).reduce((map, review) => {
      [review.reviewer_id, review.reviewee_id].forEach((id) => {
        if (id && userIds.includes(id)) map.set(id, (map.get(id) || 0) + 1);
      });
      return map;
    }, new Map()),
    spending: sumBy(spendingRes.data, 'user_id', 'amount_tokens'),
    earnings: sumBy(earningsRes.data, 'user_id', 'amount_tokens'),
  };
};

const getTutorAnalytics = async (tutorIds) => {
  if (!tutorIds.length) return new Map();

  const [sessionsRes, reviewsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('tutor_id, tutee_id, start_time, end_time, status')
      .in('tutor_id', tutorIds)
      .eq('status', 'completed'),
    supabase
      .from('reviews')
      .select('tutor_id, reviewer_id, rating')
      .in('tutor_id', tutorIds)
      .eq('reviewee_role', 'tutor')
      .is('deleted_at', null),
  ]);

  const analytics = new Map(tutorIds.map((id) => [id, {
    totalHours: 0,
    completedSessions: 0,
    studentIds: new Set(),
    reviewerIds: new Set(),
    ratings: [],
  }]));

  (sessionsRes.data || []).forEach((session) => {
    const item = analytics.get(session.tutor_id);
    if (!item) return;
    item.totalHours += hoursBetween(session.start_time, session.end_time);
    item.completedSessions += 1;
    if (session.tutee_id) item.studentIds.add(session.tutee_id);
  });

  (reviewsRes.data || []).forEach((review) => {
    const item = analytics.get(review.tutor_id);
    const rating = Number(review.rating);
    if (!item || !review.reviewer_id || !Number.isFinite(rating)) return;
    item.reviewerIds.add(review.reviewer_id);
    item.ratings.push(rating);
  });

  for (const [id, item] of analytics.entries()) {
    const averageRating = item.ratings.length
      ? item.ratings.reduce((sum, rating) => sum + rating, 0) / item.ratings.length
      : 0;
    analytics.set(id, {
      totalHours: roundOne(item.totalHours),
      completedSessions: item.completedSessions,
      uniqueStudents: item.studentIds.size,
      uniqueReviewedStudents: item.reviewerIds.size,
      averageRating: roundOne(averageRating),
      payoutQualificationStatus: getQualificationStatus({
        sessionHours: item.totalHours,
        averageRating,
        uniqueReviewers: item.reviewerIds.size,
      }),
    });
  }

  return analytics;
};

const getSessionMetrics = async (query) => {
  const { data } = await query.select('status, start_time, end_time');
  const rows = data || [];
  const total = rows.length;
  const completed = rows.filter((session) => session.status === 'completed').length;
  const cancelled = rows.filter((session) => session.status === 'cancelled').length;
  const totalDuration = rows.reduce((sum, session) => sum + hoursBetween(session.start_time, session.end_time), 0);
  return {
    completionRate: total ? Math.round((completed / total) * 1000) / 10 : 0,
    cancellationRate: total ? Math.round((cancelled / total) * 1000) / 10 : 0,
    avgSessionDurationHours: total ? roundOne(totalDuration / total) : 0,
  };
};

const tokenToKes = (tokens) => Number(tokens || 0) / 10;

const dateRange = (query, column = 'created_at') => (builder) => {
  let next = builder;
  if (query.startDate) next = next.gte(column, new Date(query.startDate).toISOString());
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setUTCHours(23, 59, 59, 999);
    next = next.lte(column, end.toISOString());
  }
  return next;
};

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

const chartFromRows = (rows, valueKey = 'value', dateKey = 'date') => {
  const byDay = new Map();
  rows.forEach((row) => {
    const day = dayKey(row[dateKey] || row.created_at || new Date());
    byDay.set(day, (byDay.get(day) || 0) + Number(row[valueKey] || 0));
  });
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, label: date, value }));
};

const textMatch = (row, search) => {
  if (!search) return true;
  const needle = String(search).toLowerCase();
  return Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle));
};

const sortRows = (rows, sortBy = 'date', sortDir = 'desc') => {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sortBy] ?? '';
    const bv = b[sortBy] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
};

const paginateRows = (rows, { from, to }) => rows.slice(from, to + 1);

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
    safeCount('sessions', (q) => q.in('status', ['pending', 'confirmed', 'in-progress'])),
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

  // ── Tokens in escrow: source of truth is currently locked escrow rows ─────
  const { data: escrowData, error: escrowError } = await supabase
    .from('escrow')
    .select('amount_tokens')
    .eq('status', 'locked');

  const tokensInEscrow = escrowError
    ? 0
    : (escrowData || []).reduce((sum, escrow) => sum + (escrow.amount_tokens || 0), 0);

  // ── Active tutors (is_available = true) ───────────────────────────────────
  const activeTutors = await safeCount('tutor_profiles', (q) => q.eq('is_available', true));

  // ── Qualification stats: canonical data from completed sessions + reviews ─
  const { data: tutorProfiles, error: tpError } = await supabase
    .from('tutor_profiles')
    .select('user_id');

  const tutorIds = (tutorProfiles || []).map((tp) => tp.user_id).filter(Boolean);

  const [
    { data: completedTutorSessions, error: qualificationSessionsError },
    { data: tutorReviews, error: qualificationReviewsError },
  ] = tutorIds.length
    ? await Promise.all([
        supabase
          .from('sessions')
          .select('tutor_id, start_time, end_time')
          .in('tutor_id', tutorIds)
          .eq('status', 'completed'),
        supabase
          .from('reviews')
          .select('tutor_id, reviewer_id, rating')
          .in('tutor_id', tutorIds)
          .eq('reviewee_role', 'tutor')
          .is('deleted_at', null),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (tpError || qualificationSessionsError || qualificationReviewsError) {
    throw new AppError('Failed to calculate tutor qualification metrics', 500);
  }

  const qualificationByTutor = new Map();
  tutorIds.forEach((tutorId) => {
    qualificationByTutor.set(tutorId, {
      tutorId,
      sessionHours: 0,
      ratings: [],
      reviewers: new Set(),
    });
  });

  (completedTutorSessions || []).forEach((session) => {
    const entry = qualificationByTutor.get(session.tutor_id);
    if (!entry) return;
    entry.sessionHours += hoursBetween(session.start_time, session.end_time);
  });

  (tutorReviews || []).forEach((review) => {
    const entry = qualificationByTutor.get(review.tutor_id);
    const rating = Number(review.rating);
    if (!entry || !review.reviewer_id || !Number.isFinite(rating) || rating < 1 || rating > 5) return;
    entry.ratings.push(rating);
    entry.reviewers.add(review.reviewer_id);
  });

  let qualifiedTutors = 0;
  let tutorsNearQualification = 0;

  for (const entry of qualificationByTutor.values()) {
    const averageRating = entry.ratings.length
      ? entry.ratings.reduce((sum, rating) => sum + rating, 0) / entry.ratings.length
      : 0;
    const { qualified, nearQualification } = classifyTutor({
      sessionHours: entry.sessionHours,
      averageRating,
      uniqueReviewers: entry.reviewers.size,
    });
    if (qualified) qualifiedTutors++;
    if (nearQualification) tutorsNearQualification++;
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
  const qualificationList = Array.from(qualificationByTutor.values()).map((entry) => {
    const sessionHours    = entry.sessionHours;
    const avgRating       = entry.ratings.length
      ? entry.ratings.reduce((sum, rating) => sum + rating, 0) / entry.ratings.length
      : 0;
    const uniqueReviewers = entry.reviewers.size;

    const { qualified, nearQualification } = classifyTutor({
      sessionHours,
      averageRating: avgRating,
      uniqueReviewers,
    });

    const hoursRemaining   = Math.max(0, MIN_SESSION_HOURS  - sessionHours);
    const reviewsRemaining = Math.max(0, MIN_UNIQUE_REVIEWS - uniqueReviewers);
    const ratingOk         = avgRating >= MIN_RATING;

    // Progress percentage (average of three criteria, capped at 100)
    const pctHours   = Math.min(100, (sessionHours    / MIN_SESSION_HOURS)   * 100);
    const pctReviews = Math.min(100, (uniqueReviewers / MIN_UNIQUE_REVIEWS) * 100);
    const pctRating  = ratingOk ? 100 : Math.min(100, (avgRating / MIN_RATING) * 100);
    const progress   = Math.round((pctHours + pctReviews + pctRating) / 3);

    return {
      tutorId: entry.tutorId,
      sessionHours: roundOne(sessionHours),
      averageRating: roundOne(avgRating),
      uniqueReviewers,
      qualified,
      nearQualification,
      hoursRemaining: roundOne(hoursRemaining),
      reviewsRemaining,
      ratingOk,
      progress,
    };
  });

  if (req.query.audit === 'true') {
    await logAdminAction(req, 'admin.overview.view', 'dashboard');
  }

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

exports.getReports = asyncHandler(async (req, res) => {
  const type = String(req.query.type || 'revenue');
  const { page, pageSize, from, to } = pageParams(req.query);
  const sortBy = String(req.query.sortBy || 'date');
  const sortDir = String(req.query.sortDir || 'desc');
  const search = req.query.search ? String(req.query.search) : '';
  const sessionDate = dateRange(req.query, 'start_time');
  const createdDate = dateRange(req.query, 'created_at');
  let rows = [];

  if (['revenue', 'token_purchases', 'failed_payments'].includes(type)) {
    let query = createdDate(supabase
      .from('payment_intents')
      .select('id, user_id, status, amount_kes, tokens_expected, created_at, profiles:user_id(email, first_name, last_name)'));
    if (type === 'revenue' || type === 'token_purchases') query = query.eq('status', 'completed');
    if (type === 'failed_payments') query = query.in('status', ['failed', 'cancelled', 'expired', 'timeout']);
    if (req.query.paymentStatus) query = query.eq('status', String(req.query.paymentStatus));
    const { data, error } = await query.order('created_at', { ascending: false }).limit(2000);
    if (error) throw new AppError('Failed to build payment report', 500);
    rows = (data || []).map((payment) => ({
      id: payment.id,
      label: profileName(payment.profiles),
      group: payment.profiles?.email || payment.user_id,
      metric: type === 'token_purchases' ? 'Tokens purchased' : 'Payment',
      value: type === 'token_purchases' ? payment.tokens_expected || 0 : payment.amount_kes || 0,
      amountKes: payment.amount_kes || 0,
      amountTokens: payment.tokens_expected || 0,
      status: payment.status,
      date: payment.created_at,
    }));
  } else if (type === 'payouts') {
    const { data, error } = await createdDate(supabase
      .from('payouts')
      .select('id, tutor_id, status, amount_tokens, created_at'))
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw new AppError('Failed to build payout report', 500);
    const tutorIds = [...new Set((data || []).map((payout) => payout.tutor_id).filter(Boolean))];
    const { data: profiles } = tutorIds.length
      ? await supabase.from('profiles').select('id, email, first_name, last_name').in('id', tutorIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    rows = (data || []).map((payout) => ({
      id: payout.id,
      label: profileName(profileById.get(payout.tutor_id)),
      group: profileById.get(payout.tutor_id)?.email || payout.tutor_id,
      metric: 'Payout',
      value: payout.amount_tokens || 0,
      amountTokens: payout.amount_tokens || 0,
      amountKes: tokenToKes(payout.amount_tokens),
      status: payout.status,
      date: payout.created_at,
    }));
  } else if (['session_completion', 'cancellations', 'subject_popularity'].includes(type)) {
    let query = sessionDate(supabase
      .from('sessions')
      .select('id, tutor_id, tutee_id, subject_id, status, start_time, end_time, token_amount, amount_tokens, cost_tokens, tutor:tutor_id(first_name, last_name, email), tutee:tutee_id(first_name, last_name, email), subjects:subject_id(name, code)'));
    if (req.query.tutor) query = query.eq('tutor_id', String(req.query.tutor));
    if (req.query.student) query = query.eq('tutee_id', String(req.query.student));
    if (req.query.subject) query = query.eq('subject_id', String(req.query.subject));
    if (req.query.sessionStatus) query = query.eq('status', String(req.query.sessionStatus));
    if (type === 'session_completion') query = query.eq('status', 'completed');
    if (type === 'cancellations') query = query.eq('status', 'cancelled');
    const { data, error } = await query.order('start_time', { ascending: false }).limit(2000);
    if (error) throw new AppError('Failed to build session report', 500);
    if (type === 'subject_popularity') {
      const bySubject = new Map();
      (data || []).forEach((session) => {
        const key = session.subject_id || 'unknown';
        const item = bySubject.get(key) || {
          id: key,
          label: session.subjects?.name || 'Unknown subject',
          group: session.subjects?.code || '-',
          metric: 'Sessions',
          value: 0,
          amountTokens: 0,
          amountKes: 0,
          status: 'active',
          date: session.start_time,
        };
        item.value += 1;
        item.amountTokens += sessionTokenAmount(session);
        item.amountKes = tokenToKes(item.amountTokens);
        bySubject.set(key, item);
      });
      rows = Array.from(bySubject.values());
    } else {
      rows = (data || []).map((session) => ({
        id: session.id,
        label: session.subjects?.name || 'Unknown subject',
        group: `${profileName(session.tutor)} / ${profileName(session.tutee)}`,
        metric: `${roundOne(hoursBetween(session.start_time, session.end_time))} hrs`,
        value: roundOne(hoursBetween(session.start_time, session.end_time)),
        amountTokens: sessionTokenAmount(session),
        amountKes: tokenToKes(sessionTokenAmount(session)),
        status: session.status,
        date: session.start_time,
      }));
    }
  } else if (type === 'user_activity') {
    const { data, error } = await createdDate(supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, created_at, is_suspended'))
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw new AppError('Failed to build user activity report', 500);
    rows = (data || []).map((user) => ({
      id: user.id,
      label: profileName(user),
      group: user.email,
      metric: user.role || 'tutee',
      value: 1,
      amountTokens: 0,
      amountKes: 0,
      status: user.is_suspended ? 'suspended' : 'active',
      date: user.created_at,
    }));
  } else if (['top_tutors', 'low_rated_tutors'].includes(type)) {
    let query = supabase
      .from('tutor_profiles')
      .select('user_id, rating_avg, total_reviews, hourly_rate_tokens, created_at, profiles:user_id(email, first_name, last_name)');
    if (req.query.tutor) query = query.eq('user_id', String(req.query.tutor));
    if (type === 'low_rated_tutors') query = query.lt('rating_avg', 3);
    const { data, error } = await query.order('rating_avg', { ascending: type === 'low_rated_tutors' }).limit(2000);
    if (error) throw new AppError('Failed to build tutor report', 500);
    rows = (data || []).map((tutor) => ({
      id: tutor.user_id,
      label: profileName(tutor.profiles),
      group: tutor.profiles?.email || tutor.user_id,
      metric: `${Number(tutor.rating_avg || 0).toFixed(1)}/5`,
      value: Number(tutor.rating_avg || 0),
      amountTokens: tutor.hourly_rate_tokens || 0,
      amountKes: tokenToKes(tutor.hourly_rate_tokens),
      status: (tutor.rating_avg || 0) < 3 ? 'low-rated' : 'active',
      date: tutor.created_at,
      meta: `${tutor.total_reviews || 0} reviews`,
    }));
  } else if (type === 'suspicious_wallets') {
    const { data, error } = await supabase
      .from('wallets')
      .select('user_id, balance_tokens, updated_at, profiles:user_id(email, first_name, last_name, is_suspended)')
      .gte('balance_tokens', 10000)
      .order('balance_tokens', { ascending: false })
      .limit(2000);
    if (error) throw new AppError('Failed to build wallet report', 500);
    rows = (data || []).map((wallet) => ({
      id: wallet.user_id,
      label: profileName(wallet.profiles),
      group: wallet.profiles?.email || wallet.user_id,
      metric: 'High balance',
      value: wallet.balance_tokens || 0,
      amountTokens: wallet.balance_tokens || 0,
      amountKes: tokenToKes(wallet.balance_tokens),
      status: wallet.profiles?.is_suspended ? 'suspended' : 'review',
      date: wallet.updated_at,
    }));
  } else {
    throw new AppError('Unsupported report type', 400);
  }

  const filtered = sortRows(rows.filter((row) => textMatch(row, search)), sortBy, sortDir);
  const summary = {
    rows: filtered.length,
    totalValue: filtered.reduce((sum, row) => sum + Number(row.value || 0), 0),
    totalTokens: filtered.reduce((sum, row) => sum + Number(row.amountTokens || 0), 0),
    totalKes: filtered.reduce((sum, row) => sum + Number(row.amountKes || 0), 0),
  };

  res.json({
    success: true,
    data: {
      rows: paginateRows(filtered, { from, to }),
      pagination: { page, pageSize, total: filtered.length },
      summary,
      chart: chartFromRows(filtered),
    },
  });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const { page, pageSize, from, to } = pageParams(req.query);
  const sortMap = {
    created_at: 'created_at',
    name: 'first_name',
    email: 'email',
    role: 'role',
  };
  const sortBy = sortMap[req.query.sortBy] || 'created_at';
  const ascending = req.query.sortDir === 'asc';
  const active = parseBooleanFilter(req.query.active);
  const verified = parseBooleanFilter(req.query.verified);
  const recentDays = Number.parseInt(req.query.recentDays, 10);

  let query = supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, is_tutor, is_verified, is_suspended, suspended_at, created_at', { count: 'exact' })
    .is('deleted_at', null);

  if (req.query.search) {
    const term = String(req.query.search).trim().replace(/[%_]/g, '');
    if (term) query = query.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }
  if (req.query.role) query = query.eq('role', String(req.query.role));
  if (active !== null) query = query.eq('is_suspended', !active);
  if (verified !== null) query = query.eq('is_verified', verified);
  if (Number.isFinite(recentDays) && recentDays > 0) {
    query = query.gte('created_at', new Date(Date.now() - recentDays * 864e5).toISOString());
  }

  const { data, error, count } = await query
    .order(sortBy, { ascending })
    .range(from, to);

  if (error) throw new AppError('Failed to fetch users', 500);

  const userIds = (data || []).map((user) => user.id);
  const [{ data: admins }, rollups] = await Promise.all([
    userIds.length
      ? supabase.from('admins').select('user_id, role, is_active').in('user_id', userIds)
      : { data: [] },
    getUserRollups(userIds),
  ]);
  const adminByUser = new Map((admins || []).map((admin) => [admin.user_id, admin]));

  res.json({
    success: true,
    data: {
      rows: (data || []).map((user) => {
        const wallet = rollups.wallets.get(user.id);
        const admin = adminByUser.get(user.id);
        return {
          id: user.id,
          title: profileName(user),
          subtitle: user.email,
          status: user.is_suspended ? 'suspended' : 'active',
          metadata: user.role || 'tutee',
          createdAt: user.created_at,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role || 'tutee',
          isTutor: user.is_tutor === true || user.role === 'tutor',
          isVerified: user.is_verified === true,
          isSuspended: user.is_suspended === true,
          suspendedAt: user.suspended_at,
          adminRole: admin?.is_active ? admin.role : null,
          wallet: { balanceTokens: wallet?.balance_tokens || 0 },
          sessionsCount: rollups.sessionCounts.get(user.id) || 0,
          reviewsCount: rollups.reviewCounts.get(user.id) || 0,
          totalSpendingTokens: Math.abs(rollups.spending.get(user.id) || 0),
          totalEarningsTokens: rollups.earnings.get(user.id) || 0,
        };
      }),
      pagination: { page, pageSize, total: count || 0 },
    },
  });
});

exports.getTutors = asyncHandler(async (req, res) => {
  const { page, pageSize, from, to } = pageParams(req.query);
  const sortMap = {
    created_at: 'created_at',
    rating: 'rating_avg',
    rate: 'hourly_rate_tokens',
    reviews: 'total_reviews',
  };
  const sortBy = sortMap[req.query.sortBy] || 'created_at';
  const ascending = req.query.sortDir === 'asc';
  const active = parseBooleanFilter(req.query.active);
  const verified = parseBooleanFilter(req.query.verified);
  let matchingTutorIds = null;

  if (req.query.search) {
    const term = String(req.query.search).trim().replace(/[%_]/g, '');
    if (term) {
      const { data: matchingProfiles, error: profileSearchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'tutor')
        .or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      if (profileSearchError) throw new AppError('Failed to search tutors', 500);
      matchingTutorIds = (matchingProfiles || []).map((profile) => profile.id);
      if (!matchingTutorIds.length) {
        return res.json({ success: true, data: { rows: [], pagination: { page, pageSize, total: 0 } } });
      }
    }
  }

  let query = supabase
    .from('tutor_profiles')
    .select('user_id, bio, hourly_rate_tokens, rating_avg, total_reviews, is_available, is_verified, created_at, profiles:user_id(email, first_name, last_name, role, is_suspended)', { count: 'exact' });

  if (matchingTutorIds) query = query.in('user_id', matchingTutorIds);
  if (verified !== null) query = query.eq('is_verified', verified);
  if (active !== null) query = query.eq('is_available', active);

  const { data, error, count } = await query
    .order(sortBy, { ascending })
    .range(from, to);

  if (error) throw new AppError('Failed to fetch tutors', 500);

  const rows = data || [];

  const tutorIds = rows.map((tutor) => tutor.user_id).filter(Boolean);
  const analytics = await getTutorAnalytics(tutorIds);

  res.json({
    success: true,
    data: {
      rows: rows.map((tutor) => {
        const item = analytics.get(tutor.user_id) || {};
        return {
          id: tutor.user_id,
          title: profileName(tutor.profiles),
          subtitle: tutor.profiles?.email || tutor.user_id,
          status: tutor.profiles?.is_suspended ? 'suspended' : (tutor.is_verified ? 'verified' : 'pending'),
          metadata: `${tutor.hourly_rate_tokens || 0} tokens/hr | ${Number(tutor.rating_avg || 0).toFixed(1)} rating`,
          createdAt: tutor.created_at,
          email: tutor.profiles?.email,
          firstName: tutor.profiles?.first_name,
          lastName: tutor.profiles?.last_name,
          hourlyRateTokens: tutor.hourly_rate_tokens || 0,
          isAvailable: tutor.is_available === true,
          isVerified: tutor.is_verified === true,
          isSuspended: tutor.profiles?.is_suspended === true,
          totalReviews: tutor.total_reviews || 0,
          ratingAvg: Number(tutor.rating_avg || 0),
          totalHours: item.totalHours || 0,
          uniqueReviewedStudents: item.uniqueReviewedStudents || 0,
          completedSessions: item.completedSessions || 0,
          averageRating: item.averageRating || 0,
          payoutQualificationStatus: item.payoutQualificationStatus || 'Pending Hours',
        };
      }),
      pagination: { page, pageSize, total: count || 0 },
    },
  });
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id && req.body?.isSuspended === true) {
    throw new AppError('You cannot suspend your own account', 400);
  }

  const isSuspended = Boolean(req.body?.isSuspended);
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_suspended: isSuspended,
      suspended_at: isSuspended ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !data) throw new AppError('Failed to update user status', 500);
  await logAdminAction(req, isSuspended ? 'user.suspend' : 'user.reactivate', 'user', id);
  res.json({ success: true, data: { id, isSuspended } });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new AppError('You cannot delete your own account', 400);

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: new Date().toISOString(),
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) throw new AppError('Failed to delete user', 500);
  await supabase.from('admins').update({ is_active: false, updated_at: new Date().toISOString() }).eq('user_id', id);
  await logAdminAction(req, 'user.delete', 'user', id);
  res.json({ success: true });
});

exports.promoteAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = String(req.body?.role || 'support_admin');
  if (!['super_admin', 'support_admin', 'finance_admin', 'moderator', 'analytics_admin'].includes(role)) {
    throw new AppError('Invalid admin role', 400);
  }

  const { data, error } = await supabase
    .from('admins')
    .upsert({ user_id: id, role, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('user_id, role')
    .single();

  if (error) throw new AppError('Failed to promote admin', 500);
  await logAdminAction(req, 'admin.promote', 'user', id, { role });
  res.json({ success: true, data });
});

exports.revokeAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new AppError('You cannot revoke your own admin access', 400);

  const { error } = await supabase
    .from('admins')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', id);

  if (error) throw new AppError('Failed to revoke admin', 500);
  await logAdminAction(req, 'admin.revoke', 'user', id);
  res.json({ success: true });
});

exports.updateTutorStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isSuspended = Boolean(req.body?.isSuspended);

  const { error } = await supabase
    .from('profiles')
    .update({
      is_suspended: isSuspended,
      suspended_at: isSuspended ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('role', 'tutor')
    .is('deleted_at', null);

  if (error) throw new AppError('Failed to update tutor status', 500);
  await logAdminAction(req, isSuspended ? 'tutor.suspend' : 'tutor.reactivate', 'tutor', id);
  res.json({ success: true, data: { id, isSuspended } });
});

exports.verifyTutor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isVerified = Boolean(req.body?.isVerified);

  const { error } = await supabase
    .from('tutor_profiles')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('user_id', id);

  if (error) throw new AppError('Failed to update tutor verification', 500);
  await supabase.from('profiles').update({ is_verified: isVerified, updated_at: new Date().toISOString() }).eq('id', id);
  await logAdminAction(req, isVerified ? 'tutor.verify' : 'tutor.unverify', 'tutor', id);
  res.json({ success: true, data: { id, isVerified } });
});

exports.getSessions = asyncHandler(async (req, res) => {
  const { page, pageSize, from, to } = pageParams(req.query);
  const sortMap = { created_at: 'created_at', start_time: 'start_time', status: 'status' };
  const sortBy = sortMap[req.query.sortBy] || 'start_time';
  const ascending = req.query.sortDir === 'asc';

  const applyFilters = (query) => {
    let next = query;
    if (req.query.tutor) next = next.eq('tutor_id', String(req.query.tutor));
    if (req.query.student) next = next.eq('tutee_id', String(req.query.student));
    if (req.query.subject) next = next.eq('subject_id', String(req.query.subject));
    if (req.query.status) next = next.eq('status', String(req.query.status));
    if (req.query.date) {
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 864e5);
      next = next.gte('start_time', start.toISOString()).lt('start_time', end.toISOString());
    }
    return next;
  };

  const listQuery = applyFilters(supabase
    .from('sessions')
    .select(`
      id, tutor_id, tutee_id, subject_id, status, start_time, end_time,
      token_amount, amount_tokens, cost_tokens, created_at,
      tutor:tutor_id(first_name, last_name, email),
      tutee:tutee_id(first_name, last_name, email),
      subjects:subject_id(id, name, code)
    `, { count: 'exact' }));

  const [{ data, error, count }, metrics] = await Promise.all([
    listQuery.order(sortBy, { ascending }).range(from, to),
    getSessionMetrics(applyFilters(supabase.from('sessions'))),
  ]);

  if (error) throw new AppError('Failed to fetch sessions', 500);

  const sessionIds = (data || []).map((session) => session.id);
  const [escrowRes, transactionRes] = await Promise.all([
    sessionIds.length
      ? supabase.from('escrow').select('id, session_id, status, amount_tokens, payer_id, payee_id, updated_at').in('session_id', sessionIds)
      : { data: [] },
    sessionIds.length
      ? supabase.from('transactions').select('id, session_id, type, status, amount_tokens, created_at').in('session_id', sessionIds)
      : { data: [] },
  ]);
  const escrowBySession = new Map((escrowRes.data || []).map((escrow) => [escrow.session_id, escrow]));
  const transactionsBySession = new Map();
  (transactionRes.data || []).forEach((transaction) => {
    const list = transactionsBySession.get(transaction.session_id) || [];
    list.push(transaction);
    transactionsBySession.set(transaction.session_id, list);
  });

  res.json({
    success: true,
    data: {
      rows: (data || []).map((session) => {
        const tokens = sessionTokenAmount(session);
        const escrow = escrowBySession.get(session.id);
        const transactions = transactionsBySession.get(session.id) || [];
        const paymentStatus = escrow?.status || transactions[0]?.status || 'none';
        return {
          id: session.id,
          title: `${profileName(session.tutor)} with ${profileName(session.tutee)}`,
          subtitle: session.subjects?.name || session.id,
          status: session.status,
          metadata: `${tokens} tokens | escrow: ${escrow?.status || 'none'} | payment: ${paymentStatus}`,
          createdAt: session.created_at,
          tutorId: session.tutor_id,
          studentId: session.tutee_id,
          subjectId: session.subject_id,
          tutorName: profileName(session.tutor),
          studentName: profileName(session.tutee),
          subjectName: session.subjects?.name || 'Unknown subject',
          startTime: session.start_time,
          endTime: session.end_time,
          durationHours: roundOne(hoursBetween(session.start_time, session.end_time)),
          tokenAmount: tokens,
          amountKes: tokenToKes(tokens),
          escrow: escrow ? {
            id: escrow.id,
            status: escrow.status,
            amountTokens: escrow.amount_tokens || 0,
            amountKes: tokenToKes(escrow.amount_tokens),
          } : null,
          payment: {
            status: paymentStatus,
            transactions: transactions.map((transaction) => ({
              id: transaction.id,
              type: transaction.type,
              status: transaction.status,
              amountTokens: transaction.amount_tokens || 0,
            })),
          },
        };
      }),
      pagination: { page, pageSize, total: count || 0 },
      metrics,
    },
  });
});

exports.cancelAdminSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (error || !session) throw new AppError('Session not found', 404);
  if (!['pending', 'confirmed', 'in-progress'].includes(session.status)) {
    throw new AppError('Only active sessions can be cancelled', 409);
  }

  const { data: escrow } = await supabase
    .from('escrow')
    .select('amount_tokens, status')
    .eq('session_id', id)
    .maybeSingle();

  if (escrow?.amount_tokens > 0 && escrow.status === 'locked') {
    await escrowService.refundTokens(id, req.correlationId);
  } else {
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id);
  }

  await logAdminAction(req, 'session.cancel', 'session', id);
  res.json({ success: true });
});

exports.resolveSessionDispute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const action = String(req.body?.action || '');

  if (!['refund', 'release', 'mark_disputed'].includes(action)) {
    throw new AppError('Invalid dispute action', 400);
  }

  if (action === 'refund') {
    await escrowService.refundTokens(id, req.correlationId);
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id);
  } else if (action === 'release') {
    await escrowService.releaseTokens(id, req.correlationId);
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', id);
  } else {
    const { error } = await supabase
      .from('escrow')
      .update({ status: 'disputed', updated_at: new Date().toISOString() })
      .eq('session_id', id)
      .eq('status', 'locked');
    if (error) throw new AppError('Failed to mark escrow disputed', 500);
  }

  await logAdminAction(req, `session.dispute.${action}`, 'session', id);
  res.json({ success: true });
});

exports.getWallets = asyncHandler(async (req, res) => {
  const { page, pageSize, from, to } = pageParams(req.query);

  let walletQuery = supabase
    .from('wallets')
    .select('user_id, balance_tokens, updated_at, profiles:user_id(email, first_name, last_name, role, is_suspended)', { count: 'exact' });

  if (req.query.search) {
    const term = String(req.query.search).trim().replace(/[%_]/g, '');
    if (term) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      if (profileError) throw new AppError('Failed to search wallets', 500);
      const ids = (profiles || []).map((profile) => profile.id);
      if (!ids.length) return res.json({ success: true, data: { rows: [], pagination: { page, pageSize, total: 0 }, metrics: {} } });
      walletQuery = walletQuery.in('user_id', ids);
    }
  }

  const { data, error, count } = await walletQuery
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) throw new AppError('Failed to fetch wallets', 500);

  const userIds = (data || []).map((wallet) => wallet.user_id);
  const [purchasesRes, escrowRes, payoutRes, txnRes, tutorAnalytics] = await Promise.all([
    userIds.length
      ? supabase.from('payment_intents').select('user_id, status, amount_kes, tokens_expected').in('user_id', userIds)
      : { data: [] },
    userIds.length
      ? supabase.from('escrow').select('payer_id, payee_id, status, amount_tokens').or(`payer_id.in.(${userIds.join(',')}),payee_id.in.(${userIds.join(',')})`)
      : { data: [] },
    userIds.length
      ? supabase.from('payouts').select('*').in('tutor_id', userIds)
      : { data: [] },
    userIds.length
      ? supabase.from('transactions').select('user_id, type, amount_tokens, status').in('user_id', userIds)
      : { data: [] },
    getTutorAnalytics(userIds),
  ]);

  const purchasesByUser = new Map();
  (purchasesRes.data || []).forEach((purchase) => {
    const item = purchasesByUser.get(purchase.user_id) || { amountKes: 0, tokens: 0, count: 0 };
    if (purchase.status === 'completed') {
      item.amountKes += Number(purchase.amount_kes || 0);
      item.tokens += Number(purchase.tokens_expected || 0);
      item.count += 1;
    }
    purchasesByUser.set(purchase.user_id, item);
  });

  const escrowByUser = new Map();
  (escrowRes.data || []).forEach((escrow) => {
    [escrow.payer_id, escrow.payee_id].forEach((id) => {
      if (!id || !userIds.includes(id)) return;
      const item = escrowByUser.get(id) || { locked: 0, refunded: 0, released: 0, disputed: 0 };
      item[escrow.status] = (item[escrow.status] || 0) + Number(escrow.amount_tokens || 0);
      escrowByUser.set(id, item);
    });
  });

  const payoutsByUser = new Map();
  (payoutRes.data || []).forEach((payout) => {
    const id = payout.tutor_id;
    const item = payoutsByUser.get(id) || { pending: 0, processing: 0, completed: 0, failed: 0 };
    item[payout.status] = (item[payout.status] || 0) + Number(payout.amount_tokens || 0);
    payoutsByUser.set(id, item);
  });

  const refundsByUser = sumBy((txnRes.data || []).filter((txn) => txn.type === 'refund'), 'user_id', 'amount_tokens');

  res.json({
    success: true,
    data: {
      rows: (data || []).map((wallet) => {
        const purchases = purchasesByUser.get(wallet.user_id) || { amountKes: 0, tokens: 0, count: 0 };
        const escrow = escrowByUser.get(wallet.user_id) || {};
        const payouts = payoutsByUser.get(wallet.user_id) || {};
        const qualification = tutorAnalytics.get(wallet.user_id);
        const isTutor = wallet.profiles?.role === 'tutor';
        const withdrawableUnlocked = isTutor && qualification?.payoutQualificationStatus === 'Qualified';
        return {
          id: wallet.user_id,
          title: profileName(wallet.profiles),
          subtitle: wallet.profiles?.email || wallet.user_id,
          status: wallet.profiles?.is_suspended ? 'suspended' : 'active',
          metadata: `${wallet.balance_tokens || 0} tokens | KSH ${tokenToKes(wallet.balance_tokens)}`,
          createdAt: wallet.updated_at,
          userId: wallet.user_id,
          role: wallet.profiles?.role || 'tutee',
          balanceTokens: wallet.balance_tokens || 0,
          balanceKes: tokenToKes(wallet.balance_tokens),
          purchaseTokens: purchases.tokens,
          purchaseKes: purchases.amountKes,
          purchaseCount: purchases.count,
          escrowLockedTokens: escrow.locked || 0,
          escrowRefundedTokens: escrow.refunded || 0,
          escrowReleasedTokens: escrow.released || 0,
          escrowDisputedTokens: escrow.disputed || 0,
          refundTokens: refundsByUser.get(wallet.user_id) || 0,
          payoutPendingTokens: payouts.pending || 0,
          payoutProcessingTokens: payouts.processing || 0,
          payoutCompletedTokens: payouts.completed || 0,
          payoutFailedTokens: payouts.failed || 0,
          withdrawableUnlocked,
          payoutQualificationStatus: isTutor ? qualification?.payoutQualificationStatus || 'Pending Hours' : 'Not tutor',
        };
      }),
      pagination: { page, pageSize, total: count || 0 },
      metrics: {
        tokensPerKes: 10,
        minimumTopUpKes: 1,
      },
    },
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

exports.getSubjectRequests = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('subject_requests')
    .select(`
      id,
      name,
      code,
      status,
      admin_notes,
      created_at,
      requested_by,
      requester:requested_by(email, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new AppError('Failed to fetch subject requests', 500);

  res.json({
    success: true,
    data: (data || []).map((request) => ({
      id: request.id,
      title: request.name,
      subtitle: profileName(request.requester),
      status: request.status,
      metadata: request.code || request.requested_by,
      createdAt: request.created_at,
    })),
  });
});

exports.approveSubjectRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: request, error: requestError } = await supabase
    .from('subject_requests')
    .select('id, name, code, status')
    .eq('id', id)
    .single();

  if (requestError || !request) throw new AppError('Subject request not found', 404);
  if (request.status !== 'pending') throw new AppError('Subject request has already been reviewed', 409);

  const name = cleanSubjectName(request.name);
  const code = request.code || subjectCodeFromName(name);

  const { data: existingSubject, error: existingError } = await supabase
    .from('subjects')
    .select('id, name, code')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new AppError('Failed to validate approved subject', 500);

  let subject = existingSubject;
  if (!subject) {
    const { data: insertedSubject, error: insertError } = await supabase
      .from('subjects')
      .insert({ name, code })
      .select('id, name, code')
      .single();

    if (insertError) {
      console.error('[approveSubjectRequest] Insert subject error:', JSON.stringify(insertError));
      throw new AppError('Failed to add approved subject', 500);
    }

    subject = insertedSubject;
  }

  const { data: matchingRequests, error: matchingError } = await supabase
    .from('subject_requests')
    .select('id, requested_by')
    .eq('status', 'pending')
    .ilike('name', name);

  if (matchingError) throw new AppError('Failed to find matching subject requests', 500);

  for (const matchingRequest of matchingRequests || []) {
    const { data: tutorProfile, error: tutorProfileError } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('user_id', matchingRequest.requested_by)
      .maybeSingle();

    if (tutorProfileError || !tutorProfile?.id) {
      console.error('[approveSubjectRequest] Tutor profile lookup error:', JSON.stringify(tutorProfileError));
      throw new AppError('Failed to find tutor profile for approved subject', 500);
    }

    const { error: joinError } = await supabase
      .from('tutor_subjects')
      .insert({ tutor_id: tutorProfile.id, subject_id: subject.id });

    if (joinError && joinError.code !== '23505') {
      console.error('[approveSubjectRequest] Insert tutor_subjects error:', JSON.stringify(joinError));
      throw new AppError('Failed to assign approved subject to tutor', 500);
    }
  }

  const requestIds = (matchingRequests || []).map((matchingRequest) => matchingRequest.id);
  const { error: updateError } = await supabase
    .from('subject_requests')
    .update({
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', requestIds.length ? requestIds : [request.id]);

  if (updateError) throw new AppError('Failed to mark subject request approved', 500);

  await logAdminAction(req, 'subject_request.approve', 'subject_request', id, {
    subjectId: subject.id,
    subjectName: subject.name,
  });

  res.json({ success: true, message: 'Subject approved', data: subject });
});

exports.rejectSubjectRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes = null } = req.body || {};

  const { data: request, error: requestError } = await supabase
    .from('subject_requests')
    .select('id, status')
    .eq('id', id)
    .single();

  if (requestError || !request) throw new AppError('Subject request not found', 404);
  if (request.status !== 'pending') throw new AppError('Subject request has already been reviewed', 409);

  const { error } = await supabase
    .from('subject_requests')
    .update({
      status: 'rejected',
      admin_notes: notes ? String(notes).trim() : null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new AppError('Failed to reject subject request', 500);

  await logAdminAction(req, 'subject_request.reject', 'subject_request', id, { notes });
  res.json({ success: true, message: 'Subject request rejected' });
});
