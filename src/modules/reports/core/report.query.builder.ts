import { REPORT_ENDPOINTS } from './report.constants';
import { toReportQueryString } from './report.filters';
import type { ReportFilter, ReportType, SortConfig } from './report.types';

export const buildReportPath = (
  type: ReportType,
  filters: ReportFilter,
  sort: SortConfig,
  page: number,
  pageSize: number,
) => `${REPORT_ENDPOINTS[type]}${toReportQueryString(filters, sort, page, pageSize)}`;
