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

export interface AdminCharts {
  sessionsTimeline: ChartDataPoint[];
  revenueTimeline: ChartDataPoint[];
  userGrowth: ChartDataPoint[];
  tokenPurchases: ChartDataPoint[];
}

export interface RecentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export interface RecentSession {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  token_amount?: number;
  amount_tokens?: number;
  cost_tokens?: number;
  created_at: string;
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