import { AlertCircle } from 'lucide-react';
import { REPORT_TITLES } from '../core/report.constants';
import type { ReportColumn, ReportRow, ReportType } from '../core/report.types';
import { ReportChartSection } from '../components/ReportChartSection';
import { ReportFilters } from '../components/ReportFilters';
import { ReportHeader } from '../components/ReportHeader';
import { ReportLoadingSkeleton } from '../components/ReportLoadingSkeleton';
import { ReportPagination } from '../components/ReportPagination';
import { ReportSummaryCards } from '../components/ReportSummaryCards';
import { ReportTable } from '../components/ReportTable';
import { useReport } from '../hooks/useReport';

interface ReportPageProps<T extends ReportRow> {
  type: ReportType;
  columns: ReportColumn<T>[];
  role: string;
  variant?: 'default' | 'admin';
}

export const ReportPage = <T extends ReportRow>({ type, columns, role, variant = 'default' }: ReportPageProps<T>) => {
  const copy = REPORT_TITLES[type];
  const report = useReport<T>({ type, columns, title: copy.title, role });
  const admin = variant === 'admin';

  return (
    <div className="space-y-6">
      <ReportHeader
        title={copy.title}
        subtitle={copy.subtitle}
        generatedAt={report.data?.exportMetadata.generatedAt}
        onExport={report.exportReport}
      />

      <ReportFilters
        filters={report.draftFilters}
        onChange={report.setDraftFilters}
        onApply={report.applyFilters}
        onReset={report.resetFilters}
        variant={variant}
      />

      {report.error && (
        <div className={admin ? 'flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100' : 'flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'}>
          <AlertCircle className="h-4 w-4" />
          {report.error}
        </div>
      )}

      {report.isLoading && !report.data ? (
        <ReportLoadingSkeleton variant={variant} />
      ) : report.data ? (
        <>
          <ReportSummaryCards metrics={report.data.summary} variant={variant} />
          <ReportChartSection charts={report.data.charts} variant={variant} />
          {report.data.exceptions.length > 0 && (
            <div className={admin ? 'rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4' : 'rounded-2xl border border-amber-200 bg-amber-50 p-4'}>
              <h2 className={admin ? 'text-sm font-bold text-amber-100' : 'text-sm font-bold text-amber-900'}>Exception Analytics</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {report.data.exceptions.slice(0, 6).map((item) => (
                  <div key={item.id} className={admin ? 'rounded-lg bg-white/5 p-3 text-sm text-amber-50' : 'rounded-lg bg-white p-3 text-sm text-amber-900'}>
                    <p className="font-semibold">{item.category}</p>
                    <p className={admin ? 'text-amber-100/80' : 'text-amber-700'}>{item.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ReportTable columns={columns} rows={report.data.rows} sort={report.sort} onSort={report.updateSort} isLoading={report.isLoading} variant={variant} />
          <ReportPagination pagination={report.data.pagination} onPageChange={report.setPage} variant={variant} />
        </>
      ) : null}
    </div>
  );
};
