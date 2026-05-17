export const ReportType = {
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
} as const;

export type ReportType = (typeof ReportType)[keyof typeof ReportType];
export type ExportFormat = 'PDF' | 'CSV' | 'EXCEL';
export type SortDirection = 'asc' | 'desc';
export type ReportValueFormat = 'number' | 'currency' | 'tokens' | 'hours' | 'percent' | 'rating' | 'text';

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface ReportFilter extends DateRangeFilter {
  tutorId?: string;
  tuteeId?: string;
  subject?: string;
  status?: string;
  paymentStatus?: string;
  transactionType?: string;
  qualificationState?: string;
  payoutStatus?: string;
  ratingThreshold?: number;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SortConfig {
  sortBy: string;
  sortDir: SortDirection;
}

export interface ReportColumn<T = ReportRow> {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  format?: ReportValueFormat;
  render?: (row: T) => ReactNode;
}

export interface ReportSummaryMetric {
  key: string;
  label: string;
  value: number | string;
  format?: ReportValueFormat;
  tone?: 'indigo' | 'purple' | 'green' | 'amber' | 'red' | 'slate';
}

export interface ReportChartPoint {
  label: string;
  value: number;
}

export interface ReportChartSeries {
  key: string;
  title: string;
  type: 'line' | 'bar' | 'area';
  data: ReportChartPoint[];
}

export interface ExceptionRecord {
  id: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  message: string;
  createdAt?: string;
}

export type ReportRow = Record<string, unknown> & { id: string };

export interface ReportData<T = ReportRow> {
  summary: ReportSummaryMetric[];
  charts: ReportChartSeries[];
  rows: T[];
  exceptions: ExceptionRecord[];
  pagination: PaginationMeta;
  filtersApplied: ReportFilter & Partial<SortConfig>;
  exportMetadata: {
    generatedAt: string;
    formats: ExportFormat[];
    rowCount: number;
  };
}
import type { ReactNode } from 'react';
