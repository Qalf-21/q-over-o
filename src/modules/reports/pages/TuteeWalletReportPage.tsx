import type React from 'react';
import { ReportType } from '../core/report.types';
import { ReportPage } from './ReportPage';
import { reportColumns } from './reportColumns';

export const TuteeWalletReportPage: React.FC = () => (
  <ReportPage type={ReportType.TUTEE_WALLET_SPENDING} columns={reportColumns.tuteeWallet} role="tutee" />
);
