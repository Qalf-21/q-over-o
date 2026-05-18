// src/features/admin/types/admin.ts — FULL REPLACEMENT

export type AdminRole =
  | 'super_admin'
  | 'support_admin'
  | 'finance_admin'
  | 'moderator'
  | 'analytics_admin';

// ── Legacy thin overview (kept for backwards compat) ─────────────────────────

export interface AdminOverview {
  totals: {
    users: number;
    tutors: number;
    sessions: number;
    wallets: number;
    reviews: number;
  };
  recentLogs: AdminLog[];
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminTableRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  metadata?: string;
  createdAt?: string;
}

export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminListResponse<T> {
  rows: T[];
  pagination: AdminPagination;
  metrics?: Record<string, number>;
}

export interface AdminListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  role?: string;
  active?: boolean;
  verified?: boolean;
  recentDays?: number;
  tutor?: string;
  student?: string;
  subject?: string;
  status?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  sessionStatus?: string;
  paymentStatus?: string;
  type?: string;
}

export interface AdminUserRow extends AdminTableRow {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isTutor: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  suspendedAt?: string | null;
  adminRole?: AdminRole | null;
  wallet: { balanceTokens: number };
  sessionsCount: number;
  reviewsCount: number;
  totalSpendingTokens: number;
  totalEarningsTokens: number;
}

export type TutorPayoutStatus =
  | 'Qualified'
  | 'Pending Hours'
  | 'Pending Reviews'
  | 'Pending Rating';

export interface AdminTutorRow extends AdminTableRow {
  email?: string;
  firstName?: string;
  lastName?: string;
  hourlyRateTokens: number;
  isAvailable: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  totalReviews: number;
  ratingAvg: number;
  totalHours: number;
  uniqueReviewedStudents: number;
  completedSessions: number;
  averageRating: number;
  payoutQualificationStatus: TutorPayoutStatus;
}

export interface AdminSessionRow extends AdminTableRow {
  tutorId: string;
  studentId: string;
  subjectId?: string;
  tutorName: string;
  studentName: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  tokenAmount: number;
  amountKes: number;
  escrow: null | {
    id: string;
    status: string;
    amountTokens: number;
    amountKes: number;
  };
  payment: {
    status: string;
    transactions: Array<{
      id: string;
      type: string;
      status: string;
      amountTokens: number;
    }>;
  };
}

export interface AdminWalletRow extends AdminTableRow {
  userId: string;
  role: string;
  balanceTokens: number;
  balanceKes: number;
  purchaseTokens: number;
  purchaseKes: number;
  purchaseCount: number;
  escrowLockedTokens: number;
  escrowRefundedTokens: number;
  escrowReleasedTokens: number;
  escrowDisputedTokens: number;
  refundTokens: number;
  payoutPendingTokens: number;
  payoutProcessingTokens: number;
  payoutCompletedTokens: number;
  payoutFailedTokens: number;
  withdrawableUnlocked: boolean;
  payoutQualificationStatus: string;
}

export type AdminReportType =
  | 'revenue'
  | 'token_purchases'
  | 'payouts'
  | 'session_completion'
  | 'cancellations'
  | 'user_activity'
  | 'top_tutors'
  | 'subject_popularity'
  | 'low_rated_tutors'
  | 'failed_payments'
  | 'suspicious_wallets';

export interface AdminReportRow {
  id: string;
  label: string;
  group: string;
  metric: string;
  value: number;
  amountTokens: number;
  amountKes: number;
  status: string;
  date: string;
  meta?: string;
}

export interface AdminReportResponse {
  rows: AdminReportRow[];
  pagination: AdminPagination;
  summary: {
    rows: number;
    totalValue: number;
    totalTokens: number;
    totalKes: number;
  };
  chart: Array<{ date: string; label: string; value: number }>;
}

// ── Full overview (new) ───────────────────────────────────────────────────────

export interface AdminMetrics {
  totalUsers: number;
  totalTutors: number;
  totalTutees: number;
  activeSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  revenueKes: number;
  tokensPurchased: number;
  tokensInEscrow: number;
  activeTutors: number;
  qualifiedTutors: number;
  tutorsNearQualification: number;
  newUsersThisWeek: number;
}

export interface ChartDataPoint {
  created_at: string;
  status?: string;
  amount_kes?: number;
  tokens_expected?: number;
  role?: string;
}

export interface PaymentChartDataPoint extends ChartDataPoint {
  amount_kes: number;
  tokens_expected: number;
}

export interface UserGrowthDataPoint extends ChartDataPoint {
  role: string;
}

export interface AdminCharts {
  sessionsTimeline: ChartDataPoint[];
  revenueTimeline: PaymentChartDataPoint[];
  userGrowth: UserGrowthDataPoint[];
  tokenPurchases: PaymentChartDataPoint[];
}

export interface RecentUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  created_at: string | null;
}

export interface RecentSession {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  token_amount?: number;
  amount_tokens?: number;
  cost_tokens?: number;
  created_at: string | null;
  tutor?: { first_name: string; last_name: string };
  tutee?: { first_name: string; last_name: string };
}

export interface RecentPayment {
  id: string;
  status: string;
  amount_kes: number;
  tokens_expected: number;
  created_at: string;
  completed_at: string | null;
  profiles?: { first_name: string; last_name: string; email: string };
}

export interface FlaggedReview {
  id: string;
  rating: number;
  comment: string;
  reviewee_role: string;
  created_at: string;
  reviewer?: { first_name: string; last_name: string };
  reviewee?: { first_name: string; last_name: string };
}

export interface AdminTables {
  recentUsers: RecentUser[];
  recentSessions: RecentSession[];
  recentPayments: RecentPayment[];
  flaggedReviews: FlaggedReview[];
}

export interface TutorQualificationEntry {
  tutorId: string;
  sessionHours: number;
  averageRating: number;
  uniqueReviewers: number;
  qualified: boolean;
  nearQualification: boolean;
  hoursRemaining: number;
  reviewsRemaining: number;
  ratingOk: boolean;
  progress: number;
}

export interface AdminQualification {
  thresholds: {
    minSessionHours: number;
    minRating: number;
    minUniqueReviews: number;
  };
  list: TutorQualificationEntry[];
}

export interface AdminFullOverview {
  metrics: AdminMetrics;
  charts: AdminCharts;
  tables: AdminTables;
  qualification: AdminQualification;
}
