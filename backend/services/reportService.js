'use strict';

const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');
const { getTutorQualificationStatus } = require('./tutorQualificationService');
const {
  REPORT_TYPES,
  normalizeFilters,
  applyDateRange,
  applyPagination,
  applySort,
} = require('./reportQueryBuilder');

const TOKENS_PER_KES = 10;
const SESSION_SELECT = 'id, tutor_id, tutee_id, subject_id, start_time, end_time, status, cost_tokens, payment_status, created_at, subjects:subject_id(id, name, code)';

const displayName = (profile) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Unknown';

const tokenAmount = (row) => Number(row?.token_amount ?? row?.amount_tokens ?? row?.cost_tokens ?? row?.amount ?? 0);
const sessionPaymentStatus = (session) => session?.payment_status || (tokenAmount(session) === 0 ? 'completed' : 'wallet');
const tokensToKes = (tokens) => Math.round((Number(tokens || 0) / TOKENS_PER_KES) * 100) / 100;
const roundOne = (value) => Math.round(Number(value || 0) * 10) / 10;

const hoursBetween = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return (endMs - startMs) / 36e5;
};

const dayKey = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
};

const aggregateByDay = (rows, valueFactory, dateFactory = (row) => row.created_at || row.start_time) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = dayKey(dateFactory(row));
    map.set(key, (map.get(key) || 0) + Number(valueFactory(row) || 0));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value: roundOne(value) }));
};

const pagination = (filters, count = 0) => ({
  page: filters.page,
  pageSize: filters.pageSize,
  total: count || 0,
  totalPages: Math.max(1, Math.ceil((count || 0) / filters.pageSize)),
});

const metric = (key, label, value, format = 'number', tone = 'indigo') => ({ key, label, value, format, tone });

const fetchProfiles = async (ids) => {
  const cleanIds = Array.from(new Set(ids.filter(Boolean)));
  if (!cleanIds.length) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, created_at, is_verified, is_suspended')
    .in('id', cleanIds);
  return new Map((data || []).map((profile) => [profile.id, profile]));
};

const fetchReviewsForSessions = async (sessionIds) => {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from('reviews')
    .select('id, session_id, reviewer_id, reviewee_id, tutor_id, rating, created_at')
    .in('session_id', ids)
    .is('deleted_at', null);
  return new Map((data || []).map((review) => [review.session_id, review]));
};

const baseResponse = ({ summary, charts, rows, exceptions, filters, count }) => ({
  summary,
  charts,
  rows,
  exceptions,
  pagination: pagination(filters, count),
  filtersApplied: {
    startDate: filters.startDate,
    endDate: filters.endDate,
    tutorId: filters.tutorId,
    tuteeId: filters.tuteeId,
    subject: filters.subject,
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    transactionType: filters.transactionType,
    qualificationState: filters.qualificationState,
    payoutStatus: filters.payoutStatus,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  },
  exportMetadata: {
    generatedAt: new Date().toISOString(),
    formats: ['PDF', 'CSV', 'EXCEL'],
    rowCount: count || rows.length,
  },
});

const assertRole = (type, user) => {
  const role = user?.role || user?.profile?.role || 'tutee';
  const adminRole = user?.adminRole || user?.admin_role;
  if (type.startsWith('ADMIN_') && !adminRole) throw new AppError('Admin report access denied', 403, 'ADMIN_FORBIDDEN');
  if (type.startsWith('TUTOR_') && role !== 'tutor') throw new AppError('Tutor report access denied', 403, 'FORBIDDEN');
};

const sessionSubjectFilter = (query, filters) => {
  if (!filters.subject) return query;
  return query.eq('subject_id', filters.subject);
};

const buildSessionQuery = (filters, scope = {}) => {
  let query = supabase
    .from('sessions')
    .select(SESSION_SELECT, { count: 'exact' });
  query = applyDateRange(query, filters, 'start_time');
  if (scope.tutorId) query = query.eq('tutor_id', scope.tutorId);
  if (scope.tuteeId) query = query.eq('tutee_id', scope.tuteeId);
  if (filters.tutorId) query = query.eq('tutor_id', filters.tutorId);
  if (filters.tuteeId) query = query.eq('tutee_id', filters.tuteeId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.paymentStatus === 'completed') query = query.or('payment_status.eq.completed,payment_status.is.null');
  if (filters.paymentStatus === 'failed') query = query.eq('payment_status', 'failed');
  query = sessionSubjectFilter(query, filters);
  return query;
};

const getAllFilteredSessions = async (filters, scope = {}) => {
  const { data, error } = await buildSessionQuery({ ...filters, from: 0, to: 9999 }, scope).range(0, 9999);
  if (error) throw new AppError(`Failed to load session report data: ${error.message}`, 500, 'REPORT_QUERY_FAILED');
  return data || [];
};

const tuteeSessionHistory = async (filters, user) => {
  const [pageRes, allRows] = await Promise.all([
    applyPagination(applySort(buildSessionQuery(filters, { tuteeId: user.id }), filters, 'start_time'), filters),
    getAllFilteredSessions(filters, { tuteeId: user.id }),
  ]);
  if (pageRes.error) throw new AppError('Failed to load session report', 500, 'REPORT_QUERY_FAILED');

  const pageRows = pageRes.data || [];
  const [profiles, reviewMap] = await Promise.all([
    fetchProfiles(pageRows.map((row) => row.tutor_id)),
    fetchReviewsForSessions(pageRows.map((row) => row.id)),
  ]);

  const rows = pageRows.map((session) => {
    const hours = hoursBetween(session.start_time, session.end_time);
    const reviewed = reviewMap.has(session.id);
    return {
      id: session.id,
      tutor: displayName(profiles.get(session.tutor_id)),
      subject: session.subjects?.name || 'General',
      sessionDate: session.start_time,
      durationHours: roundOne(hours),
      tokensSpent: tokenAmount(session),
      reviewSubmitted: reviewed,
      outcome: session.status === 'completed' ? 'Completed learning session' : 'Not completed',
      status: session.status,
    };
  });

  const totalHours = allRows.reduce((sum, row) => sum + hoursBetween(row.start_time, row.end_time), 0);
  const totalSpent = allRows.reduce((sum, row) => sum + tokenAmount(row), 0);
  const completed = allRows.filter((row) => row.status === 'completed').length;
  const reviewMapAll = await fetchReviewsForSessions(allRows.map((row) => row.id));
  const exceptions = allRows
    .filter((row) => row.status === 'cancelled' || row.payment_status === 'failed' || hoursBetween(row.start_time, row.end_time) > 3 || (row.status === 'completed' && !reviewMapAll.has(row.id)))
    .slice(0, 50)
    .map((row) => ({
      id: row.id,
      severity: row.payment_status === 'failed' ? 'high' : 'medium',
      category: row.payment_status === 'failed' ? 'Failed payment' : row.status === 'cancelled' ? 'Cancelled session' : hoursBetween(row.start_time, row.end_time) > 3 ? 'Unusually long session' : 'Missing review',
      message: `${row.subjects?.name || 'Session'} on ${dayKey(row.start_time)}`,
      createdAt: row.start_time,
    }));

  return baseResponse({
    summary: [
      metric('totalSessions', 'Total sessions', allRows.length),
      metric('completedSessions', 'Completed sessions', completed),
      metric('totalStudyHours', 'Study hours', roundOne(totalHours), 'hours'),
      metric('averageDuration', 'Average duration', allRows.length ? roundOne(totalHours / allRows.length) : 0, 'hours'),
      metric('totalTokensSpent', 'Tokens spent', totalSpent, 'tokens'),
    ],
    charts: [
      { key: 'studyHoursTrend', title: 'Study hours trend', type: 'line', data: aggregateByDay(allRows, (row) => hoursBetween(row.start_time, row.end_time), (row) => row.start_time) },
      { key: 'spendingTrend', title: 'Token spending trend', type: 'bar', data: aggregateByDay(allRows, tokenAmount, (row) => row.start_time) },
    ],
    rows,
    exceptions,
    filters,
    count: pageRes.count,
  });
};

const walletSpending = async (filters, user) => {
  const buildQuery = () => {
    let query = supabase
      .from('transactions')
      .select('id, type, amount_tokens, balance_after, status, reference, description, session_id, created_at', { count: 'exact' })
      .eq('user_id', user.id);
    query = applyDateRange(query, filters, 'created_at');
    if (filters.transactionType) query = query.eq('type', filters.transactionType);
    if (filters.paymentStatus) query = query.eq('status', filters.paymentStatus);
    if (filters.minAmount !== undefined) query = query.gte('amount_tokens', filters.minAmount);
    if (filters.maxAmount !== undefined) query = query.lte('amount_tokens', filters.maxAmount);
    return query;
  };

  const [pageRes, allRes, walletRes] = await Promise.all([
    applyPagination(applySort(buildQuery(), filters, 'created_at'), filters),
    buildQuery().range(0, 9999),
    supabase.from('wallets').select('balance_tokens').eq('user_id', user.id).maybeSingle(),
  ]);
  if (pageRes.error) throw new AppError('Failed to load wallet report', 500, 'REPORT_QUERY_FAILED');
  const allRows = allRes.data || [];
  const rows = (pageRes.data || []).map((tx) => ({
    id: tx.id,
    reference: tx.reference || tx.id,
    amountTokens: Number(tx.amount_tokens || 0),
    balanceAfter: Number(tx.balance_after || 0),
    transactionDate: tx.created_at,
    paymentChannel: tx.reference?.toLowerCase().includes('mpesa') ? 'M-Pesa' : 'Wallet',
    escrowMovement: tx.type === 'escrow' || Boolean(tx.session_id),
    type: tx.type,
    status: tx.status,
  }));
  const purchases = allRows.filter((tx) => Number(tx.amount_tokens || 0) > 0);
  const spending = allRows.filter((tx) => Number(tx.amount_tokens || 0) < 0);
  const exceptions = allRows
    .filter((tx, index, arr) => tx.status === 'failed' || Math.abs(Number(tx.amount_tokens || 0)) > 5000 || arr.some((other) => other.id !== tx.id && other.reference && other.reference === tx.reference))
    .slice(0, 50)
    .map((tx) => ({
      id: tx.id,
      severity: tx.status === 'failed' ? 'high' : 'medium',
      category: tx.status === 'failed' ? 'Failed payment' : 'Wallet anomaly',
      message: `${tx.reference || tx.type} for ${Number(tx.amount_tokens || 0).toLocaleString()} tokens`,
      createdAt: tx.created_at,
    }));

  return baseResponse({
    summary: [
      metric('tokensPurchased', 'Tokens purchased', purchases.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0), 'tokens'),
      metric('tokensSpent', 'Tokens spent', Math.abs(spending.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0)), 'tokens'),
      metric('averagePurchase', 'Average purchase', purchases.length ? roundOne(purchases.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0) / purchases.length) : 0, 'tokens'),
      metric('walletBalance', 'Wallet balance', walletRes.data?.balance_tokens || 0, 'tokens'),
    ],
    charts: [{ key: 'balanceTrend', title: 'Wallet activity trend', type: 'line', data: aggregateByDay(allRows, (tx) => Math.abs(Number(tx.amount_tokens || 0))) }],
    rows,
    exceptions,
    filters,
    count: pageRes.count,
  });
};

const tutorEarnings = async (filters, user) => {
  const buildQuery = () => {
    let query = supabase
      .from('transactions')
      .select('id, type, amount_tokens, balance_after, status, reference, description, session_id, created_at', { count: 'exact' })
      .eq('user_id', user.id);
    query = applyDateRange(query, filters, 'created_at');
    if (filters.paymentStatus || filters.payoutStatus) query = query.eq('status', filters.paymentStatus || filters.payoutStatus);
    return query;
  };

  const [pageRes, allRes, escrowRes, qualification] = await Promise.all([
    applyPagination(applySort(buildQuery(), filters, 'created_at'), filters),
    buildQuery().range(0, 9999),
    supabase.from('escrow').select('id, session_id, amount_tokens, status, updated_at').eq('payee_id', user.id).range(0, 9999),
    getTutorQualificationStatus(user.id),
  ]);
  if (pageRes.error) throw new AppError('Failed to load earnings report', 500, 'REPORT_QUERY_FAILED');
  const allRows = allRes.data || [];
  const escrowRows = escrowRes.data || [];
  const released = allRows.filter((tx) => Number(tx.amount_tokens || 0) > 0 && tx.status === 'completed');
  const pendingEscrow = escrowRows.filter((row) => row.status === 'locked').reduce((sum, row) => sum + Number(row.amount_tokens || 0), 0);
  const rows = (pageRes.data || []).map((tx) => ({
    id: tx.id,
    reference: tx.reference || tx.id,
    completedSessions: tx.session_id ? 1 : 0,
    earningsReleased: tx.status === 'completed' && Number(tx.amount_tokens || 0) > 0 ? Number(tx.amount_tokens || 0) : 0,
    pendingEscrow: 0,
    deductions: Number(tx.amount_tokens || 0) < 0 ? Math.abs(Number(tx.amount_tokens || 0)) : 0,
    payoutStatus: tx.status,
    qualificationStatus: qualification.state,
    transactionDate: tx.created_at,
  }));
  const exceptions = [
    ...allRows.filter((tx) => tx.status === 'failed').map((tx) => ({ id: tx.id, severity: 'high', category: 'Failed payout', message: tx.reference || tx.description || 'Failed tutor transaction', createdAt: tx.created_at })),
    ...escrowRows.filter((row) => row.status === 'locked').slice(0, 20).map((row) => ({ id: row.id, severity: 'medium', category: 'Pending escrow', message: `Escrow waiting release: ${row.amount_tokens} tokens`, createdAt: row.updated_at })),
  ].slice(0, 50);

  return baseResponse({
    summary: [
      metric('totalEarnings', 'Total earnings', released.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0), 'tokens'),
      metric('pendingEarnings', 'Pending earnings', pendingEscrow, 'tokens'),
      metric('releasedEarnings', 'Released earnings', released.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0), 'tokens'),
      metric('averagePerSession', 'Average per session', released.length ? roundOne(released.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0) / released.length) : 0, 'tokens'),
      metric('qualification', 'Qualification progress', qualification.progressPercentage, 'percent'),
    ],
    charts: [{ key: 'monthlyRevenueTrend', title: 'Revenue trend', type: 'bar', data: aggregateByDay(released, (tx) => Number(tx.amount_tokens || 0)) }],
    rows,
    exceptions,
    filters,
    count: pageRes.count,
  });
};

const tutorPerformance = async (filters, user) => {
  const [pageRes, allSessions, reviewsRes, qualification] = await Promise.all([
    applyPagination(applySort(buildSessionQuery(filters, { tutorId: user.id }), filters, 'start_time'), filters),
    getAllFilteredSessions(filters, { tutorId: user.id }),
    applyDateRange(supabase.from('reviews').select('id, session_id, reviewer_id, rating, created_at', { count: 'exact' }).eq('tutor_id', user.id).eq('reviewee_role', 'tutor').is('deleted_at', null), filters, 'created_at').range(0, 9999),
    getTutorQualificationStatus(user.id),
  ]);
  if (pageRes.error) throw new AppError('Failed to load performance report', 500, 'REPORT_QUERY_FAILED');
  const reviews = reviewsRes.data || [];
  const avgRating = reviews.length ? reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length : 0;
  const completed = allSessions.filter((row) => row.status === 'completed');
  const cancelled = allSessions.filter((row) => row.status === 'cancelled');
  const students = new Set(allSessions.map((row) => row.tutee_id).filter(Boolean));
  const repeatStudents = new Set(Array.from(students).filter((id) => allSessions.filter((row) => row.tutee_id === id).length > 1));
  const rows = (pageRes.data || []).map((session) => ({
    id: session.id,
    subject: session.subjects?.name || 'General',
    completedHours: roundOne(hoursBetween(session.start_time, session.end_time)),
    averageRating: roundOne(avgRating),
    reviewCount: reviews.filter((review) => review.session_id === session.id).length,
    cancellationRate: allSessions.length ? roundOne((cancelled.length / allSessions.length) * 100) : 0,
    completionRate: allSessions.length ? roundOne((completed.length / allSessions.length) * 100) : 0,
    repeatStudentRatio: students.size ? roundOne((repeatStudents.size / students.size) * 100) : 0,
    qualificationProgress: qualification.progressPercentage,
    sessionDate: session.start_time,
  }));
  const exceptions = [];
  if (avgRating > 0 && avgRating < 3.5) exceptions.push({ id: 'rating-risk', severity: 'high', category: 'Declining ratings', message: `Average rating is ${roundOne(avgRating)}`, createdAt: new Date().toISOString() });
  if (allSessions.length && cancelled.length / allSessions.length > 0.2) exceptions.push({ id: 'cancellation-risk', severity: 'high', category: 'High cancellations', message: `${roundOne((cancelled.length / allSessions.length) * 100)}% cancellation rate`, createdAt: new Date().toISOString() });
  if (!qualification.qualified && qualification.progressPercentage >= 75) exceptions.push({ id: 'qualification-risk', severity: 'medium', category: 'Qualification risk', message: 'Close to qualification but not yet eligible', createdAt: new Date().toISOString() });

  return baseResponse({
    summary: [
      metric('teachingHours', 'Teaching hours', roundOne(completed.reduce((sum, row) => sum + hoursBetween(row.start_time, row.end_time), 0)), 'hours'),
      metric('averageRating', 'Average rating', roundOne(avgRating), 'rating'),
      metric('studentsTaught', 'Students taught', students.size),
      metric('qualificationPercentage', 'Qualification', qualification.progressPercentage, 'percent'),
      metric('completionRate', 'Completion rate', allSessions.length ? roundOne((completed.length / allSessions.length) * 100) : 0, 'percent'),
    ],
    charts: [
      { key: 'hoursTrend', title: 'Teaching hours trend', type: 'line', data: aggregateByDay(completed, (row) => hoursBetween(row.start_time, row.end_time), (row) => row.start_time) },
      { key: 'ratingTrend', title: 'Rating trend', type: 'line', data: aggregateByDay(reviews, (row) => Number(row.rating || 0)) },
    ],
    rows,
    exceptions,
    filters,
    count: pageRes.count,
  });
};

const adminTransactions = async (filters, kind) => {
  const buildQuery = () => {
    let query = supabase.from('transactions').select('id, user_id, type, amount_tokens, balance_after, status, reference, session_id, created_at', { count: 'exact' });
    query = applyDateRange(query, filters, 'created_at');
    if (filters.transactionType) query = query.eq('type', filters.transactionType);
    if (filters.paymentStatus) query = query.eq('status', filters.paymentStatus);
    return query;
  };
  const [pageRes, allRes] = await Promise.all([
    applyPagination(applySort(buildQuery(), filters, 'created_at'), filters),
    buildQuery().range(0, 9999),
  ]);
  if (pageRes.error) throw new AppError('Failed to load wallet audit report', 500, 'REPORT_QUERY_FAILED');
  const profiles = await fetchProfiles((pageRes.data || []).map((row) => row.user_id));
  const allRows = allRes.data || [];
  const rows = (pageRes.data || []).map((tx) => ({
    id: tx.id,
    user: displayName(profiles.get(tx.user_id)),
    reference: tx.reference || tx.id,
    amountTokens: Number(tx.amount_tokens || 0),
    amountKes: tokensToKes(tx.amount_tokens),
    balanceAfter: Number(tx.balance_after || 0),
    type: tx.type,
    status: tx.status,
    transactionDate: tx.created_at,
  }));
  const exceptions = allRows
    .filter((tx, index, arr) => tx.status === 'failed' || Math.abs(Number(tx.amount_tokens || 0)) > 10000 || arr.some((other) => other.id !== tx.id && other.reference && other.reference === tx.reference))
    .slice(0, 50)
    .map((tx) => ({ id: tx.id, severity: tx.status === 'failed' ? 'high' : 'medium', category: tx.status === 'failed' ? 'Failed transaction' : 'Suspicious wallet activity', message: tx.reference || tx.id, createdAt: tx.created_at }));
  const totalTokens = allRows.reduce((sum, tx) => sum + Number(tx.amount_tokens || 0), 0);
  return baseResponse({
    summary: [
      metric('transactionCount', kind === 'revenue' ? 'Revenue records' : 'Transactions', allRows.length),
      metric('tokenMovement', 'Token movement', totalTokens, 'tokens'),
      metric('kesEquivalent', 'KES equivalent', tokensToKes(totalTokens), 'currency'),
      metric('failedTransactions', 'Failed transactions', allRows.filter((tx) => tx.status === 'failed').length),
    ],
    charts: [{ key: 'tokenMovementTrend', title: kind === 'revenue' ? 'Revenue trend' : 'Wallet movement trend', type: 'bar', data: aggregateByDay(allRows, (tx) => Math.abs(Number(tx.amount_tokens || 0))) }],
    rows,
    exceptions,
    filters,
    count: pageRes.count,
  });
};

const adminSessions = async (filters) => {
  const [pageRes, allRows] = await Promise.all([
    applyPagination(applySort(buildSessionQuery(filters), filters, 'start_time'), filters),
    getAllFilteredSessions(filters),
  ]);
  if (pageRes.error) throw new AppError('Failed to load session analytics report', 500, 'REPORT_QUERY_FAILED');
  const profiles = await fetchProfiles((pageRes.data || []).flatMap((row) => [row.tutor_id, row.tutee_id]));
  const rows = (pageRes.data || []).map((session) => ({
    id: session.id,
    tutor: displayName(profiles.get(session.tutor_id)),
    student: displayName(profiles.get(session.tutee_id)),
    subject: session.subjects?.name || 'General',
    sessionDate: session.start_time,
    durationHours: roundOne(hoursBetween(session.start_time, session.end_time)),
    tokens: tokenAmount(session),
    status: session.status,
    paymentStatus: sessionPaymentStatus(session),
  }));
  const completed = allRows.filter((row) => row.status === 'completed');
  const cancelled = allRows.filter((row) => row.status === 'cancelled');
  return baseResponse({
    summary: [
      metric('sessions', 'Sessions', allRows.length),
      metric('completed', 'Completed', completed.length),
      metric('cancelled', 'Cancelled', cancelled.length),
      metric('completionRate', 'Completion rate', allRows.length ? roundOne((completed.length / allRows.length) * 100) : 0, 'percent'),
      metric('studyHours', 'Platform hours', roundOne(completed.reduce((sum, row) => sum + hoursBetween(row.start_time, row.end_time), 0)), 'hours'),
    ],
    charts: [
      { key: 'sessionTrend', title: 'Session volume trend', type: 'line', data: aggregateByDay(allRows, () => 1, (row) => row.start_time) },
      { key: 'tokenTrend', title: 'Session token trend', type: 'bar', data: aggregateByDay(allRows, tokenAmount, (row) => row.start_time) },
    ],
    rows,
    exceptions: allRows.filter((row) => row.status === 'cancelled' || row.payment_status === 'failed').slice(0, 50).map((row) => ({ id: row.id, severity: row.payment_status === 'failed' ? 'high' : 'medium', category: row.payment_status === 'failed' ? 'Failed payment' : 'Cancellation', message: `${row.subjects?.name || 'Session'} on ${dayKey(row.start_time)}`, createdAt: row.start_time })),
    filters,
    count: pageRes.count,
  });
};

const adminUsers = async (filters) => {
  const buildQuery = () => {
    let query = supabase.from('profiles').select('id, first_name, last_name, email, role, created_at, is_verified, is_suspended', { count: 'exact' });
    query = applyDateRange(query, filters, 'created_at');
    if (filters.search) query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
    return query;
  };
  const [pageRes, allRes] = await Promise.all([applyPagination(applySort(buildQuery(), filters, 'created_at'), filters), buildQuery().range(0, 9999)]);
  if (pageRes.error) throw new AppError('Failed to load user analytics report', 500, 'REPORT_QUERY_FAILED');
  const allRows = allRes.data || [];
  return baseResponse({
    summary: [
      metric('users', 'Users', allRows.length),
      metric('tutors', 'Tutors', allRows.filter((row) => row.role === 'tutor').length),
      metric('students', 'Students', allRows.filter((row) => row.role !== 'tutor').length),
      metric('suspended', 'Suspended', allRows.filter((row) => row.is_suspended).length),
    ],
    charts: [{ key: 'userGrowth', title: 'User growth', type: 'line', data: aggregateByDay(allRows, () => 1) }],
    rows: (pageRes.data || []).map((profile) => ({ id: profile.id, user: displayName(profile), email: profile.email, role: profile.role || 'tutee', verified: Boolean(profile.is_verified), suspended: Boolean(profile.is_suspended), createdAt: profile.created_at })),
    exceptions: allRows.filter((row) => row.is_suspended).map((row) => ({ id: row.id, severity: 'medium', category: 'Suspended user', message: displayName(row), createdAt: row.created_at })),
    filters,
    count: pageRes.count,
  });
};

const adminSubjects = async (filters) => {
  const sessions = await getAllFilteredSessions(filters);
  const bySubject = new Map();
  sessions.forEach((session) => {
    const key = session.subjects?.name || 'General';
    const current = bySubject.get(key) || { id: key, subject: key, sessions: 0, hours: 0, tokens: 0, cancellations: 0 };
    current.sessions += 1;
    current.hours += hoursBetween(session.start_time, session.end_time);
    current.tokens += tokenAmount(session);
    if (session.status === 'cancelled') current.cancellations += 1;
    bySubject.set(key, current);
  });
  const subjectRows = Array.from(bySubject.values()).sort((a, b) => b.sessions - a.sessions);
  const rows = subjectRows.slice(filters.from, filters.to + 1).map((row) => ({ ...row, hours: roundOne(row.hours), cancellationRate: row.sessions ? roundOne((row.cancellations / row.sessions) * 100) : 0 }));
  return baseResponse({
    summary: [
      metric('subjects', 'Active subjects', subjectRows.length),
      metric('sessions', 'Subject sessions', sessions.length),
      metric('hours', 'Learning hours', roundOne(subjectRows.reduce((sum, row) => sum + row.hours, 0)), 'hours'),
      metric('tokens', 'Tokens', subjectRows.reduce((sum, row) => sum + row.tokens, 0), 'tokens'),
    ],
    charts: [{ key: 'subjectPopularity', title: 'Subject popularity', type: 'bar', data: subjectRows.slice(0, 10).map((row) => ({ label: row.subject, value: row.sessions })) }],
    rows,
    exceptions: subjectRows.filter((row) => row.sessions > 0 && row.cancellations / row.sessions > 0.3).map((row) => ({ id: row.id, severity: 'medium', category: 'Low-performing subject', message: `${row.subject} has elevated cancellations`, createdAt: new Date().toISOString() })),
    filters,
    count: subjectRows.length,
  });
};

const adminReviews = async (filters) => {
  const buildQuery = () => {
    let query = supabase.from('reviews').select('id, tutor_id, reviewer_id, rating, comment, created_at', { count: 'exact' }).is('deleted_at', null);
    query = applyDateRange(query, filters, 'created_at');
    if (filters.tutorId) query = query.eq('tutor_id', filters.tutorId);
    if (filters.ratingThreshold !== undefined) query = query.lte('rating', filters.ratingThreshold);
    return query;
  };
  const [pageRes, allRes] = await Promise.all([applyPagination(applySort(buildQuery(), filters, 'created_at'), filters), buildQuery().range(0, 9999)]);
  if (pageRes.error) throw new AppError('Failed to load review analytics report', 500, 'REPORT_QUERY_FAILED');
  const profiles = await fetchProfiles((pageRes.data || []).flatMap((row) => [row.tutor_id, row.reviewer_id]));
  const allRows = allRes.data || [];
  const avg = allRows.length ? allRows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / allRows.length : 0;
  return baseResponse({
    summary: [
      metric('reviews', 'Reviews', allRows.length),
      metric('averageRating', 'Average rating', roundOne(avg), 'rating'),
      metric('lowRatings', 'Low ratings', allRows.filter((row) => Number(row.rating || 0) < 3).length),
      metric('reviewers', 'Reviewers', new Set(allRows.map((row) => row.reviewer_id)).size),
    ],
    charts: [{ key: 'ratingTrend', title: 'Rating trend', type: 'line', data: aggregateByDay(allRows, (row) => Number(row.rating || 0)) }],
    rows: (pageRes.data || []).map((review) => ({ id: review.id, tutor: displayName(profiles.get(review.tutor_id)), reviewer: displayName(profiles.get(review.reviewer_id)), rating: review.rating, comment: review.comment || '', createdAt: review.created_at })),
    exceptions: allRows.filter((row) => Number(row.rating || 0) < 3).slice(0, 50).map((row) => ({ id: row.id, severity: 'medium', category: 'Low rating', message: `${row.rating} star tutor review`, createdAt: row.created_at })),
    filters,
    count: pageRes.count,
  });
};

const adminQualifications = async (filters) => {
  let query = supabase.from('tutor_profiles').select('id, user_id, headline, is_active, is_verified, created_at', { count: 'exact' });
  query = applyDateRange(query, filters, 'created_at');
  const pageRes = await applyPagination(applySort(query, filters, 'created_at'), filters);
  if (pageRes.error) throw new AppError('Failed to load qualification report', 500, 'REPORT_QUERY_FAILED');
  const tutors = pageRes.data || [];
  const [profiles, statuses] = await Promise.all([
    fetchProfiles(tutors.map((row) => row.user_id)),
    Promise.all(tutors.map((row) => getTutorQualificationStatus(row.user_id).catch(() => null))),
  ]);
  const rows = tutors.map((tutor, index) => {
    const status = statuses[index] || {};
    return {
      id: tutor.user_id,
      tutor: displayName(profiles.get(tutor.user_id)),
      state: status.state || 'UNKNOWN',
      qualified: Boolean(status.qualified),
      hoursCompleted: status.hoursCompleted || 0,
      averageRating: status.averageRating || 0,
      uniqueReviewers: status.uniqueReviewerCount || 0,
      progressPercentage: status.progressPercentage || 0,
      verified: Boolean(tutor.is_verified),
      active: Boolean(tutor.is_active),
    };
  }).filter((row) => !filters.qualificationState || row.state === filters.qualificationState);
  return baseResponse({
    summary: [
      metric('tutors', 'Tutors reviewed', rows.length),
      metric('qualified', 'Qualified tutors', rows.filter((row) => row.qualified).length),
      metric('nearQualification', 'Close to qualification', rows.filter((row) => !row.qualified && row.progressPercentage >= 75).length),
      metric('averageProgress', 'Average progress', rows.length ? roundOne(rows.reduce((sum, row) => sum + row.progressPercentage, 0) / rows.length) : 0, 'percent'),
    ],
    charts: [{ key: 'qualificationProgress', title: 'Qualification progress', type: 'bar', data: rows.map((row) => ({ label: row.tutor, value: row.progressPercentage })).slice(0, 12) }],
    rows,
    exceptions: rows.filter((row) => !row.qualified && row.progressPercentage >= 75).map((row) => ({ id: row.id, severity: 'medium', category: 'Tutor close to qualification', message: `${row.tutor} is ${row.progressPercentage}% complete`, createdAt: new Date().toISOString() })),
    filters,
    count: pageRes.count,
  });
};

const adminExceptions = async (filters) => {
  const [wallet, sessions, reviews, qualifications] = await Promise.all([
    adminTransactions({ ...filters, page: 1, pageSize: 50, from: 0, to: 49 }, 'wallet'),
    adminSessions({ ...filters, page: 1, pageSize: 50, from: 0, to: 49 }),
    adminReviews({ ...filters, page: 1, pageSize: 50, from: 0, to: 49, ratingThreshold: filters.ratingThreshold ?? 2 }),
    adminQualifications({ ...filters, page: 1, pageSize: 50, from: 0, to: 49 }),
  ]);
  const exceptions = [...wallet.exceptions, ...sessions.exceptions, ...reviews.exceptions, ...qualifications.exceptions];
  const rows = exceptions.slice(filters.from, filters.to + 1);
  return baseResponse({
    summary: [
      metric('exceptions', 'Exceptions', exceptions.length),
      metric('highSeverity', 'High severity', exceptions.filter((row) => row.severity === 'high').length),
      metric('mediumSeverity', 'Medium severity', exceptions.filter((row) => row.severity === 'medium').length),
      metric('categories', 'Categories', new Set(exceptions.map((row) => row.category)).size),
    ],
    charts: [{ key: 'exceptionCategories', title: 'Exception categories', type: 'bar', data: Array.from(exceptions.reduce((map, row) => map.set(row.category, (map.get(row.category) || 0) + 1), new Map()).entries()).map(([label, value]) => ({ label, value })) }],
    rows,
    exceptions,
    filters,
    count: exceptions.length,
  });
};

async function generateReport(type, rawFilters, userContext) {
  assertRole(type, userContext);
  const filters = normalizeFilters(rawFilters);
  switch (type) {
    case REPORT_TYPES.TUTEE_SESSION_HISTORY:
      return tuteeSessionHistory(filters, userContext);
    case REPORT_TYPES.TUTEE_WALLET_SPENDING:
      return walletSpending(filters, userContext);
    case REPORT_TYPES.TUTOR_EARNINGS:
      return tutorEarnings(filters, userContext);
    case REPORT_TYPES.TUTOR_PERFORMANCE:
      return tutorPerformance(filters, userContext);
    case REPORT_TYPES.ADMIN_PLATFORM_REVENUE:
      return adminTransactions(filters, 'revenue');
    case REPORT_TYPES.ADMIN_WALLET_AUDIT:
      return adminTransactions(filters, 'wallet');
    case REPORT_TYPES.ADMIN_SESSION_ANALYTICS:
      return adminSessions(filters);
    case REPORT_TYPES.ADMIN_USER_ANALYTICS:
      return adminUsers(filters);
    case REPORT_TYPES.ADMIN_EXCEPTION_REPORTS:
      return adminExceptions(filters);
    case REPORT_TYPES.ADMIN_SUBJECT_ANALYTICS:
      return adminSubjects(filters);
    case REPORT_TYPES.ADMIN_REVIEW_ANALYTICS:
      return adminReviews(filters);
    case REPORT_TYPES.ADMIN_TUTOR_QUALIFICATION_PROGRESS:
      return adminQualifications(filters);
    default:
      throw new AppError('Unknown report type', 400, 'UNKNOWN_REPORT_TYPE');
  }
}

module.exports = {
  generateReport,
  REPORT_TYPES,
};
