import { ReportType, type ExportFormat } from './report.types';

export const REPORT_ENDPOINTS: Record<ReportType, string> = {
  [ReportType.TUTEE_SESSION_HISTORY]: '/reports/tutee/sessions',
  [ReportType.TUTEE_WALLET_SPENDING]: '/reports/tutee/wallet',
  [ReportType.TUTOR_EARNINGS]: '/reports/tutor/earnings',
  [ReportType.TUTOR_PERFORMANCE]: '/reports/tutor/performance',
  [ReportType.ADMIN_PLATFORM_REVENUE]: '/reports/admin/revenue',
  [ReportType.ADMIN_WALLET_AUDIT]: '/reports/admin/wallet',
  [ReportType.ADMIN_SESSION_ANALYTICS]: '/reports/admin/sessions',
  [ReportType.ADMIN_USER_ANALYTICS]: '/reports/admin/users',
  [ReportType.ADMIN_EXCEPTION_REPORTS]: '/reports/admin/exceptions',
  [ReportType.ADMIN_SUBJECT_ANALYTICS]: '/reports/admin/subjects',
  [ReportType.ADMIN_REVIEW_ANALYTICS]: '/reports/admin/reviews',
  [ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS]: '/reports/admin/qualifications',
};

export const EXPORT_FORMATS: ExportFormat[] = ['PDF', 'CSV', 'EXCEL'];

export const REPORT_TITLES: Record<ReportType, { title: string; subtitle: string }> = {
  [ReportType.TUTEE_SESSION_HISTORY]: {
    title: 'Session Reports',
    subtitle: 'Analyze completed, cancelled, reviewed, and paid tutoring sessions.',
  },
  [ReportType.TUTEE_WALLET_SPENDING]: {
    title: 'Wallet Reports',
    subtitle: 'Review token purchases, deductions, escrow movements, and spending patterns.',
  },
  [ReportType.TUTOR_EARNINGS]: {
    title: 'Earnings Reports',
    subtitle: 'Track released earnings, pending escrow, deductions, and payout health.',
  },
  [ReportType.TUTOR_PERFORMANCE]: {
    title: 'Performance Reports',
    subtitle: 'Measure teaching hours, reviews, retention, cancellations, and qualification progress.',
  },
  [ReportType.ADMIN_PLATFORM_REVENUE]: {
    title: 'Financial Reports',
    subtitle: 'Audit revenue, token movement, transaction status, and platform financial trends.',
  },
  [ReportType.ADMIN_WALLET_AUDIT]: {
    title: 'Wallet Audit Reports',
    subtitle: 'Inspect wallet ledger movements, anomalous balances, and transaction risk.',
  },
  [ReportType.ADMIN_SESSION_ANALYTICS]: {
    title: 'Session Reports',
    subtitle: 'Monitor tutoring volume, completion behavior, cancellations, and token flow.',
  },
  [ReportType.ADMIN_USER_ANALYTICS]: {
    title: 'User Reports',
    subtitle: 'Analyze user growth, role mix, verification, and operational account states.',
  },
  [ReportType.ADMIN_EXCEPTION_REPORTS]: {
    title: 'Exception Reports',
    subtitle: 'Surface financial, tutoring, review, wallet, and qualification risks.',
  },
  [ReportType.ADMIN_SUBJECT_ANALYTICS]: {
    title: 'Subject Analytics',
    subtitle: 'Compare subject demand, learning hours, token flow, and cancellation pressure.',
  },
  [ReportType.ADMIN_REVIEW_ANALYTICS]: {
    title: 'Review Analytics',
    subtitle: 'Track ratings, review volume, low-rating patterns, and reviewer diversity.',
  },
  [ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS]: {
    title: 'Qualification Reports',
    subtitle: 'Monitor tutor qualification progress using the platform qualification service.',
  },
};
