import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_REPORT_FILTERS, DEFAULT_SORT } from '../core/report.filters';
import { reportService } from '../core/report.service';
import type { ExportFormat, ReportColumn, ReportData, ReportFilter, ReportRow, ReportType, SortConfig } from '../core/report.types';
import { exportReport as exportReportFile } from '../export/export.service';

interface UseReportOptions<T extends ReportRow> {
  type: ReportType;
  columns: ReportColumn<T>[];
  title: string;
  role: string;
  initialFilters?: ReportFilter;
  initialSort?: SortConfig;
  pageSize?: number;
}

export const useReport = <T extends ReportRow>({
  type,
  columns,
  title,
  role,
  initialFilters = DEFAULT_REPORT_FILTERS,
  initialSort = DEFAULT_SORT,
  pageSize: initialPageSize = 20,
}: UseReportOptions<T>) => {
  const [filters, setFilters] = useState<ReportFilter>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<ReportFilter>(initialFilters);
  const [sort, setSort] = useState<SortConfig>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [data, setData] = useState<ReportData<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setIsLoading(true);
    setError(null);
    try {
      const result = await reportService.getReport<T>(type, filters, sort, page, pageSize);
      if (requestId.current === currentRequest) setData(result);
    } catch (err) {
      if (requestId.current === currentRequest) setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [filters, page, pageSize, sort, type]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 300);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const applyFilters = useCallback(() => {
    setPage(1);
    setFilters(draftFilters);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_REPORT_FILTERS);
    setFilters(DEFAULT_REPORT_FILTERS);
    setPage(1);
  }, []);

  const updateSort = useCallback((sortBy: string) => {
    setPage(1);
    setSort((current) => ({
      sortBy,
      sortDir: current.sortBy === sortBy && current.sortDir === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const exportReport = useCallback((format: ExportFormat) => {
    if (!data) return;
    exportReportFile(title, format, data, columns, role);
  }, [columns, data, role, title]);

  return useMemo(() => ({
    data,
    draftFilters,
    error,
    filters,
    isLoading,
    page,
    pageSize,
    sort,
    applyFilters,
    exportReport,
    refresh: load,
    resetFilters,
    setDraftFilters,
    setPage,
    setPageSize,
    updateSort,
  }), [applyFilters, data, draftFilters, error, exportReport, filters, isLoading, load, page, pageSize, resetFilters, sort, updateSort]);
};
