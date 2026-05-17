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
