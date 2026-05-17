import type { ReportFilter, SortConfig } from './report.types';

export const DEFAULT_REPORT_FILTERS: ReportFilter = {};
export const DEFAULT_SORT: SortConfig = { sortBy: 'newest', sortDir: 'desc' };

export const toReportQueryString = (
  filters: ReportFilter,
  sort: SortConfig,
  page: number,
  pageSize: number,
) => {
  const query = new URLSearchParams();
  Object.entries({ ...filters, ...sort, page, pageSize }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : '';
};
