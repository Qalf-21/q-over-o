import type React from 'react';
import type { PaginationMeta } from '../core/report.types';

interface ReportPaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  variant?: 'default' | 'admin';
}

export const ReportPagination: React.FC<ReportPaginationProps> = ({ pagination, onPageChange, variant = 'default' }) => {
  const canPrevious = pagination.page > 1;
  const canNext = pagination.page < pagination.totalPages;
  const text = variant === 'admin' ? 'text-slate-300' : 'text-gray-600';
  return (
    <div className={`flex items-center justify-between text-sm ${text}`}>
      <button
        type="button"
        disabled={!canPrevious}
        onClick={() => onPageChange(pagination.page - 1)}
        className="rounded-lg px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} records</span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(pagination.page + 1)}
        className="rounded-lg px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
};
