import type React from 'react';
import { ReportType } from '../core/report.types';
import { ReportPage } from './ReportPage';
import { reportColumns } from './reportColumns';

export const TutorEarningsReportPage: React.FC = () => (
  <ReportPage type={ReportType.TUTOR_EARNINGS} columns={reportColumns.tutorEarnings} role="tutor" />
);
