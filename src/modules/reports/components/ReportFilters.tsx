import type React from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import type { ReportFilter } from '../core/report.types';

interface ReportFiltersProps {
  filters: ReportFilter;
  onChange: (filters: ReportFilter) => void;
  onApply: () => void;
  onReset: () => void;
  variant?: 'default' | 'admin';
}

const fieldClass = (variant: 'default' | 'admin') =>
  variant === 'admin'
    ? 'rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500'
    : 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400';

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onChange,
  onApply,
  onReset,
  variant = 'default',
}) => {
  const update = (patch: ReportFilter) => onChange({ ...filters, ...patch });
  const classes = fieldClass(variant);
  const labelColor = variant === 'admin' ? 'text-slate-400' : 'text-gray-500';

  return (
    <details className={variant === 'admin' ? 'rounded-2xl border border-white/10 bg-white/[0.06] p-4' : 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm'} open>
      <summary className={`flex cursor-pointer items-center gap-2 text-sm font-semibold ${variant === 'admin' ? 'text-white' : 'text-gray-900'}`}>
        <Filter className="h-4 w-4" />
        Filters
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Start date</span>
          <input className={classes} type="date" value={filters.startDate || ''} onChange={(event) => update({ startDate: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>End date</span>
          <input className={classes} type="date" value={filters.endDate || ''} onChange={(event) => update({ endDate: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Status</span>
          <select className={classes} value={filters.status || ''} onChange={(event) => update({ status: event.target.value || undefined })}>
            <option value="">Any status</option>
            <option value="completed">Completed</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Subject ID</span>
          <input className={classes} value={filters.subject || ''} placeholder="Subject" onChange={(event) => update({ subject: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Tutor ID</span>
          <input className={classes} value={filters.tutorId || ''} placeholder="Tutor" onChange={(event) => update({ tutorId: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Student ID</span>
          <input className={classes} value={filters.tuteeId || ''} placeholder="Student" onChange={(event) => update({ tuteeId: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Transaction type</span>
          <input className={classes} value={filters.transactionType || ''} placeholder="credit, debit, escrow" onChange={(event) => update({ transactionType: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Payment status</span>
          <input className={classes} value={filters.paymentStatus || ''} placeholder="completed, failed" onChange={(event) => update({ paymentStatus: event.target.value || undefined })} />
        </label>
        <label className="space-y-1">
          <span className={`text-xs font-medium ${labelColor}`}>Rating at/below</span>
          <input className={classes} type="number" min="1" max="5" value={filters.ratingThreshold ?? ''} onChange={(event) => update({ ratingThreshold: event.target.value ? Number(event.target.value) : undefined })} />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={`text-xs font-medium ${labelColor}`}>Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input className={`${classes} w-full pl-9`} value={filters.search || ''} placeholder="Search records" onChange={(event) => update({ search: event.target.value || undefined })} />
          </div>
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={onApply} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Apply</button>
          <button type="button" onClick={onReset} className={variant === 'admin' ? 'inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15' : 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50'}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </details>
  );
};
