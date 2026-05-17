import type React from 'react';
import { ReportType, type ReportColumn, type ReportRow, type ReportType as ReportTypeValue } from '../core/report.types';
import { ReportPage } from './ReportPage';
import { reportColumns } from './reportColumns';

type AdminReportType =
  | typeof ReportType.ADMIN_PLATFORM_REVENUE
  | typeof ReportType.ADMIN_WALLET_AUDIT
  | typeof ReportType.ADMIN_SESSION_ANALYTICS
  | typeof ReportType.ADMIN_USER_ANALYTICS
  | typeof ReportType.ADMIN_EXCEPTION_REPORTS
  | typeof ReportType.ADMIN_SUBJECT_ANALYTICS
  | typeof ReportType.ADMIN_REVIEW_ANALYTICS
  | typeof ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS;

const adminColumns = {
  [ReportType.ADMIN_PLATFORM_REVENUE]: reportColumns.adminRevenue,
  [ReportType.ADMIN_WALLET_AUDIT]: reportColumns.adminRevenue,
  [ReportType.ADMIN_SESSION_ANALYTICS]: reportColumns.adminSessions,
  [ReportType.ADMIN_USER_ANALYTICS]: reportColumns.adminUsers,
  [ReportType.ADMIN_EXCEPTION_REPORTS]: reportColumns.exceptions,
  [ReportType.ADMIN_SUBJECT_ANALYTICS]: reportColumns.adminSubjects,
  [ReportType.ADMIN_REVIEW_ANALYTICS]: reportColumns.adminReviews,
  [ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS]: reportColumns.adminQualifications,
} satisfies Record<AdminReportType, ReportColumn<ReportRow>[]>;

export const AdminReportPage: React.FC<{ type: ReportTypeValue }> = ({ type }) => (
  <ReportPage type={type} columns={type in adminColumns ? adminColumns[type as AdminReportType] : reportColumns.adminRevenue} role="admin" variant="admin" />
);
