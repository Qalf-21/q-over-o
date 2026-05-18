'use strict';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const REPORT_TYPES = Object.freeze({
  TUTEE_SESSION_HISTORY: 'TUTEE_SESSION_HISTORY',
  TUTEE_WALLET_SPENDING: 'TUTEE_WALLET_SPENDING',
  TUTOR_EARNINGS: 'TUTOR_EARNINGS',
  TUTOR_PERFORMANCE: 'TUTOR_PERFORMANCE',
  ADMIN_PLATFORM_REVENUE: 'ADMIN_PLATFORM_REVENUE',
  ADMIN_WALLET_AUDIT: 'ADMIN_WALLET_AUDIT',
  ADMIN_SESSION_ANALYTICS: 'ADMIN_SESSION_ANALYTICS',
  ADMIN_USER_ANALYTICS: 'ADMIN_USER_ANALYTICS',
  ADMIN_EXCEPTION_REPORTS: 'ADMIN_EXCEPTION_REPORTS',
  ADMIN_SUBJECT_ANALYTICS: 'ADMIN_SUBJECT_ANALYTICS',
  ADMIN_REVIEW_ANALYTICS: 'ADMIN_REVIEW_ANALYTICS',
  ADMIN_TUTOR_QUALIFICATION_PROGRESS: 'ADMIN_TUTOR_QUALIFICATION_PROGRESS',
});

const ROUTE_TO_REPORT_TYPE = Object.freeze({
  'tutee/sessions': REPORT_TYPES.TUTEE_SESSION_HISTORY,
  'tutee/wallet': REPORT_TYPES.TUTEE_WALLET_SPENDING,
  'tutor/earnings': REPORT_TYPES.TUTOR_EARNINGS,
  'tutor/performance': REPORT_TYPES.TUTOR_PERFORMANCE,
  'admin/revenue': REPORT_TYPES.ADMIN_PLATFORM_REVENUE,
  'admin/wallet': REPORT_TYPES.ADMIN_WALLET_AUDIT,
  'admin/sessions': REPORT_TYPES.ADMIN_SESSION_ANALYTICS,
  'admin/users': REPORT_TYPES.ADMIN_USER_ANALYTICS,
  'admin/exceptions': REPORT_TYPES.ADMIN_EXCEPTION_REPORTS,
  'admin/subjects': REPORT_TYPES.ADMIN_SUBJECT_ANALYTICS,
  'admin/reviews': REPORT_TYPES.ADMIN_REVIEW_ANALYTICS,
  'admin/qualifications': REPORT_TYPES.ADMIN_TUTOR_QUALIFICATION_PROGRESS,
});

const SORT_MAP = Object.freeze({
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  date_desc: { column: 'created_at', ascending: false },
  date_asc: { column: 'created_at', ascending: true },
  longest_duration: { column: 'start_time', ascending: false },
  highest_spend: { column: 'cost_tokens', ascending: false },
  token_amount: { column: 'cost_tokens', ascending: false },
  cost_tokens: { column: 'cost_tokens', ascending: false },
  highest_amount: { column: 'amount_tokens', ascending: false },
  rating_desc: { column: 'rating', ascending: false },
  name_asc: { column: 'created_at', ascending: true },
});

const numberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const stringOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).trim();
};

const parsePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(5, Number.parseInt(query.pageSize || query.limit, 10) || DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
};

const normalizeFilters = (query = {}) => {
  const pagination = parsePagination(query);
  return {
    startDate: stringOrUndefined(query.startDate || query.start_date),
    endDate: stringOrUndefined(query.endDate || query.end_date),
    tutorId: stringOrUndefined(query.tutorId || query.tutor || query.tutor_id),
    tuteeId: stringOrUndefined(query.tuteeId || query.student || query.tutee_id),
    subject: stringOrUndefined(query.subject || query.subjectId || query.subject_id),
    status: stringOrUndefined(query.status || query.sessionStatus),
    paymentStatus: stringOrUndefined(query.paymentStatus || query.payment_status),
    transactionType: stringOrUndefined(query.transactionType || query.type),
    qualificationState: stringOrUndefined(query.qualificationState || query.qualification_state),
    payoutStatus: stringOrUndefined(query.payoutStatus || query.payout_status),
    ratingThreshold: numberOrUndefined(query.ratingThreshold || query.rating_threshold),
    minAmount: numberOrUndefined(query.minAmount || query.min_amount),
    maxAmount: numberOrUndefined(query.maxAmount || query.max_amount),
    search: stringOrUndefined(query.search),
    sortBy: stringOrUndefined(query.sortBy || query.sort || 'newest'),
    sortDir: stringOrUndefined(query.sortDir || query.sort_dir),
    page: pagination.page,
    pageSize: pagination.pageSize,
    from: pagination.from,
    to: pagination.to,
  };
};

const applyDateRange = (query, filters, column = 'created_at') => {
  let next = query;
  if (filters.startDate) next = next.gte(column, new Date(filters.startDate).toISOString());
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setUTCHours(23, 59, 59, 999);
    next = next.lte(column, end.toISOString());
  }
  return next;
};

const applyPagination = (query, filters) => query.range(filters.from, filters.to);

const applySort = (query, filters, fallbackColumn = 'created_at') => {
  const mapped = SORT_MAP[filters.sortBy] || {};
  const column = mapped.column || filters.sortBy || fallbackColumn;
  const ascending = filters.sortDir ? filters.sortDir === 'asc' : Boolean(mapped.ascending);
  return query.order(column, { ascending });
};

module.exports = {
  REPORT_TYPES,
  ROUTE_TO_REPORT_TYPE,
  normalizeFilters,
  applyDateRange,
  applyPagination,
  applySort,
};
