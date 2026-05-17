import { ArrowUpDown } from 'lucide-react';
import type { ReportColumn, ReportRow, SortConfig } from '../core/report.types';
import { ReportEmptyState } from './ReportEmptyState';

interface ReportTableProps<T extends ReportRow> {
  columns: ReportColumn<T>[];
  rows: T[];
  sort: SortConfig;
  onSort: (key: string) => void;
  isLoading?: boolean;
  variant?: 'default' | 'admin';
}

const cellValue = <T extends ReportRow>(row: T, column: ReportColumn<T>) => {
  if (column.render) return column.render(row);
  const value = row[column.key];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
  return value === undefined || value === null || value === '' ? '-' : String(value);
};

export const ReportTable = <T extends ReportRow>({
  columns,
  rows,
  sort,
  onSort,
  isLoading = false,
  variant = 'default',
}: ReportTableProps<T>) => {
  if (!isLoading && rows.length === 0) return <ReportEmptyState variant={variant} />;
  const admin = variant === 'admin';
  return (
    <div className={admin ? 'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]' : 'overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className={admin ? 'bg-white/[0.03]' : 'bg-gray-50'}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={admin ? 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400' : 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'}>
                  {column.sortable ? (
                    <button type="button" onClick={() => onSort(column.sortKey || column.key)} className="inline-flex items-center gap-1">
                      {column.label}
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sort.sortBy === (column.sortKey || column.key) ? 'text-indigo-500' : ''}`} />
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={admin ? 'divide-y divide-white/10' : 'divide-y divide-gray-100'}>
            {isLoading ? Array.from({ length: 6 }).map((_, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column.key} className="px-5 py-4"><div className={admin ? 'h-4 w-28 animate-pulse rounded bg-white/10' : 'h-4 w-28 animate-pulse rounded bg-gray-100'} /></td>)}
              </tr>
            )) : rows.map((row) => (
              <tr key={row.id} className={admin ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'}>
                {columns.map((column) => (
                  <td key={column.key} className={admin ? 'whitespace-nowrap px-5 py-4 text-sm text-slate-200' : 'whitespace-nowrap px-5 py-4 text-sm text-gray-700'}>
                    {cellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
