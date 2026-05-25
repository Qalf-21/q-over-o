import type React from 'react';
import { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { tutorApi } from '../../../api/tutorApi';
import { ReportType, type ReportFilter, type ReportType as ReportTypeValue } from '../core/report.types';

interface ReportFiltersProps {
  filters: ReportFilter;
  onChange: (filters: ReportFilter) => void;
  onApply: () => void;
  onReset: () => void;
  reportType: ReportTypeValue;
  variant?: 'default' | 'admin';
}

interface SubjectOption {
  id: string;
  name: string;
}

const SESSION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'declined', label: 'Declined' },
];

const SESSION_PAYMENT_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const TRANSACTION_STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'escrow', label: 'Escrow' },
  { value: 'release', label: 'Release' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'refund', label: 'Refund' },
];

const QUALIFICATION_STATE_OPTIONS = [
  { value: 'NOT_QUALIFIED', label: 'Not qualified' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'QUALIFIED', label: 'Qualified' },
];

const fieldClass = (variant: 'default' | 'admin') =>
  variant === 'admin'
    ? 'rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500'
    : 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400';

const isReportType = (reportType: ReportTypeValue, reportTypes: ReportTypeValue[]) =>
  reportTypes.includes(reportType);

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onChange,
  onApply,
  onReset,
  reportType,
  variant = 'default',
}) => {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const update = (patch: ReportFilter) => onChange({ ...filters, ...patch });
  const classes = fieldClass(variant);
  const labelColor = variant === 'admin' ? 'text-slate-400' : 'text-gray-500';
  const isAdmin = variant === 'admin';

  const hasSessionStatus = isReportType(reportType, [
    ReportType.TUTEE_SESSION_HISTORY,
    ReportType.TUTOR_PERFORMANCE,
    ReportType.ADMIN_SESSION_ANALYTICS,
    ReportType.ADMIN_SUBJECT_ANALYTICS,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);
  const hasSubject = isReportType(reportType, [
    ReportType.TUTEE_SESSION_HISTORY,
    ReportType.TUTOR_PERFORMANCE,
    ReportType.ADMIN_SESSION_ANALYTICS,
    ReportType.ADMIN_SUBJECT_ANALYTICS,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);
  const hasSessionPaymentStatus = isReportType(reportType, [
    ReportType.TUTEE_SESSION_HISTORY,
    ReportType.ADMIN_SESSION_ANALYTICS,
  ]);
  const hasTransactionFilters = isReportType(reportType, [
    ReportType.TUTEE_WALLET_SPENDING,
    ReportType.ADMIN_PLATFORM_REVENUE,
    ReportType.ADMIN_WALLET_AUDIT,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);
  const hasPayoutStatus = reportType === ReportType.TUTOR_EARNINGS;
  const hasRatingThreshold = isReportType(reportType, [
    ReportType.ADMIN_REVIEW_ANALYTICS,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);
  const hasQualificationState = reportType === ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS;
  const hasSearch = reportType === ReportType.ADMIN_USER_ANALYTICS;
  const hasTutorFilter = isReportType(reportType, [
    ReportType.ADMIN_SESSION_ANALYTICS,
    ReportType.ADMIN_SUBJECT_ANALYTICS,
    ReportType.ADMIN_REVIEW_ANALYTICS,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);
  const hasStudentFilter = isReportType(reportType, [
    ReportType.ADMIN_SESSION_ANALYTICS,
    ReportType.ADMIN_SUBJECT_ANALYTICS,
    ReportType.ADMIN_EXCEPTION_REPORTS,
  ]);

  useEffect(() => {
    if (!hasSubject) return;
    let cancelled = false;
    tutorApi.getSubjects()
      .then((response) => {
        if (cancelled) return;
        const raw = Array.isArray(response.data) ? response.data : [];
        setSubjects(raw.map((subject) => ({
          id: subject.id || '',
          name: subject.name || 'General',
        })).filter((subject) => subject.id));
      })
      .catch(() => {
        if (!cancelled) setSubjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSubject]);

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
        {hasSessionStatus && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Session status</span>
            <select className={classes} value={filters.status || ''} onChange={(event) => update({ status: event.target.value || undefined })}>
              <option value="">All session statuses</option>
              {SESSION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {hasSubject && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Subject</span>
            <select className={classes} value={filters.subject || ''} onChange={(event) => update({ subject: event.target.value || undefined })}>
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
        )}
        {isAdmin && hasTutorFilter && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Tutor ID</span>
            <input className={classes} value={filters.tutorId || ''} placeholder="Tutor ID" onChange={(event) => update({ tutorId: event.target.value || undefined })} />
          </label>
        )}
        {isAdmin && hasStudentFilter && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Student ID</span>
            <input className={classes} value={filters.tuteeId || ''} placeholder="Student ID" onChange={(event) => update({ tuteeId: event.target.value || undefined })} />
          </label>
        )}
        {hasTransactionFilters && (
          <>
            <label className="space-y-1">
              <span className={`text-xs font-medium ${labelColor}`}>Transaction type</span>
              <select className={classes} value={filters.transactionType || ''} onChange={(event) => update({ transactionType: event.target.value || undefined })}>
                <option value="">All transaction types</option>
                {TRANSACTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={`text-xs font-medium ${labelColor}`}>Transaction status</span>
              <select className={classes} value={filters.paymentStatus || ''} onChange={(event) => update({ paymentStatus: event.target.value || undefined })}>
                <option value="">All transaction statuses</option>
                {TRANSACTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {hasSessionPaymentStatus && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Session payment</span>
            <select className={classes} value={filters.paymentStatus || ''} onChange={(event) => update({ paymentStatus: event.target.value || undefined })}>
              <option value="">All payment statuses</option>
              {SESSION_PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {hasPayoutStatus && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Payout status</span>
            <select className={classes} value={filters.payoutStatus || ''} onChange={(event) => update({ payoutStatus: event.target.value || undefined })}>
              <option value="">All payout statuses</option>
              {TRANSACTION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {hasQualificationState && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Qualification state</span>
            <select className={classes} value={filters.qualificationState || ''} onChange={(event) => update({ qualificationState: event.target.value || undefined })}>
              <option value="">All qualification states</option>
              {QUALIFICATION_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {hasRatingThreshold && (
          <label className="space-y-1">
            <span className={`text-xs font-medium ${labelColor}`}>Rating at/below</span>
            <input className={classes} type="number" min="1" max="5" value={filters.ratingThreshold ?? ''} onChange={(event) => update({ ratingThreshold: event.target.value ? Number(event.target.value) : undefined })} />
          </label>
        )}
        {hasSearch && (
          <label className="space-y-1 md:col-span-2">
            <span className={`text-xs font-medium ${labelColor}`}>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input className={`${classes} w-full pl-9`} value={filters.search || ''} placeholder="Search names or emails" onChange={(event) => update({ search: event.target.value || undefined })} />
            </div>
          </label>
        )}
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
