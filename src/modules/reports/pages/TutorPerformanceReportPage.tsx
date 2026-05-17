import type React from 'react';
import { ReportType } from '../core/report.types';
import { ReportPage } from './ReportPage';
import { reportColumns } from './reportColumns';

export const TutorPerformanceReportPage: React.FC = () => (
  <ReportPage type={ReportType.TUTOR_PERFORMANCE} columns={reportColumns.tutorPerformance} role="tutor" />
);
