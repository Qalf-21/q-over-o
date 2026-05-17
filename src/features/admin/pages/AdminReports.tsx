import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { AdminMiniChart } from '../components/AdminMiniChart';
import { AdminOverviewTable, StatusBadge, type TableColumn } from '../components/AdminOverviewTable';
import type { AdminListParams, AdminPagination, AdminReportRow, AdminReportType } from '../types/admin';
import { exportReport } from '../utils/exportReport';

const pageSize = 20;

const reportTypes: Array<{ value: AdminReportType; label: string }> = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'token_purchases', label: 'Token purchases' },
  { value: 'payouts', label: 'Payouts' },
  { value: 'session_completion', label: 'Session completion' },
  { value: 'cancellations', label: 'Cancellations' },
  { value: 'user_activity', label: 'User activity' },
  { value: 'top_tutors', label: 'Top tutors' },
  { value: 'subject_popularity', label: 'Subject popularity' },
  { value: 'low_rated_tutors', label: 'Low-rated tutors' },
  { value: 'failed_payments', label: 'Failed payments' },
  { value: 'suspicious_wallets', label: 'Suspicious wallets' },
];

const columns: TableColumn<AdminReportRow>[] = [
  { header: 'Record', render: (r) => <div><p className="text-sm font-semibold text-white">{r.label}</p><p className="text-xs text-slate-400">{r.group}</p></div> },
  { header: 'Metric', render: (r) => <span className="text-sm text-slate-200">{r.metric}</span> },
  { header: 'Value', render: (r) => <span className="text-sm text-slate-200">{r.value.toLocaleString()}</span> },
  { header: 'Tokens', render: (r) => <span className="text-sm text-slate-200">{r.amountTokens.toLocaleString()}</span> },
  { header: 'KSH', render: (r) => <span className="text-sm text-slate-200">{r.amountKes.toLocaleString()}</span> },
  { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { header: 'Date', render: (r) => <span className="text-sm text-slate-400">{new Date(r.date).toLocaleDateString()}</span> },
];

export const AdminReports: React.FC = () => {
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({ page: 1, pageSize, total: 0 });
  const [summary, setSummary] = useState({ rows: 0, totalValue: 0, totalTokens: 0, totalKes: 0 });
  const [chart, setChart] = useState<Array<{ date: string; label: string; value: number }>>([]);
  const [filters, setFilters] = useState<AdminListParams>({ type: 'revenue', page: 1, pageSize, sortBy: 'date', sortDir: 'desc' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const title = useMemo(() => reportTypes.find((r) => r.value === filters.type)?.label || 'Report', [filters.type]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setIsLoading(true);
          setError('');
        }
        return adminApi.getReports(filters);
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows);
          setPagination(data.pagination);
          setSummary(data.summary);
          setChart(data.chart);
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const update = (patch: Partial<AdminListParams>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Essential financial, operational, academic, and exception reports.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-4">
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" value={filters.type} onChange={(e) => update({ type: e.target.value })}>
          {reportTypes.map((report) => <option key={report.value} value={report.value}>{report.label}</option>)}
        </select>
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Search" onChange={(e) => update({ search: e.target.value })} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" type="date" onChange={(e) => update({ startDate: e.target.value || undefined })} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" type="date" onChange={(e) => update({ endDate: e.target.value || undefined })} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Tutor ID" onChange={(e) => update({ tutor: e.target.value || undefined })} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Student ID" onChange={(e) => update({ student: e.target.value || undefined })} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Subject ID" onChange={(e) => update({ subject: e.target.value || undefined })} />
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => update({ sessionStatus: e.target.value || undefined })}>
          <option value="">Session status</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => update({ paymentStatus: e.target.value || undefined })}>
          <option value="">Payment status</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => {
          const [sortBy, sortDir] = e.target.value.split(':');
          update({ sortBy, sortDir: sortDir as 'asc' | 'desc' });
        }}>
          <option value="date:desc">Newest</option><option value="date:asc">Oldest</option><option value="value:desc">Highest value</option><option value="label:asc">Name</option>
        </select>
        <button className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport(rows, title, 'csv')}>CSV</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport(rows, title, 'excel')}>Excel</button>
          <button className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport(rows, title, 'pdf')}>PDF</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Rows</p><p className="mt-1 text-2xl font-bold text-white">{summary.rows}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Value</p><p className="mt-1 text-2xl font-bold text-white">{summary.totalValue.toLocaleString()}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Tokens</p><p className="mt-1 text-2xl font-bold text-white">{summary.totalTokens.toLocaleString()}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">KSH</p><p className="mt-1 text-2xl font-bold text-white">{summary.totalKes.toLocaleString()}</p></div>
      </div>

      <AdminMiniChart title={`${title} trend`} data={chart} color="sky" isLoading={isLoading} />
      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <AdminOverviewTable title={title} rows={rows} columns={columns} keyExtractor={(row) => row.id} isLoading={isLoading} />

      <div className="flex items-center justify-between text-sm text-slate-300">
        <button disabled={pagination.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}>Previous</button>
        <span>Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}</span>
        <button disabled={pagination.page * pagination.pageSize >= pagination.total} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}>Next</button>
      </div>
    </div>
  );
};
