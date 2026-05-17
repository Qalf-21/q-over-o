import { apiRequest } from '../../../api/client';
import { buildReportPath } from './report.query.builder';
import type { ReportData, ReportFilter, ReportRow, ReportType, SortConfig } from './report.types';

export const reportService = {
  async getReport<T extends ReportRow>(
    type: ReportType,
    filters: ReportFilter,
    sort: SortConfig,
    page: number,
    pageSize: number,
  ): Promise<ReportData<T>> {
    const response = await apiRequest<ReportData<T>>(buildReportPath(type, filters, sort, page, pageSize));
    if (!response.data) throw new Error('No report data returned');
    return response.data;
  },
};
