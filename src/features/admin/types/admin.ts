export type AdminRole =
  | 'super_admin'
  | 'support_admin'
  | 'finance_admin'
  | 'moderator'
  | 'analytics_admin';

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
