import type React from 'react';
import { ReportType } from '../core/report.types';
import { ReportPage } from './ReportPage';
import { reportColumns } from './reportColumns';

export const TuteeSessionReportPage: React.FC = () => (
  <ReportPage type={ReportType.TUTEE_SESSION_HISTORY} columns={reportColumns.tuteeSessions} role="tutee" />
);
