import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { AdminDataTable } from '../components/AdminDataTable';
import type { AdminListParams, AdminPagination, AdminSessionRow, AdminTableRow } from '../types/admin';

const pageSize = 20;

export const AdminSessions: React.FC = () => {
  const [rows, setRows] = useState<AdminSessionRow[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({ page: 1, pageSize, total: 0 });
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<AdminListParams>({ page: 1, pageSize, sortBy: 'start_time', sortDir: 'desc' });
  const [selected, setSelected] = useState<AdminSessionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setIsLoading(true);
          setError('');
        }
        return adminApi.getManagedSessions(filters);
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows);
          setPagination(data.pagination);
          setMetrics(data.metrics || {});
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const tableRows: AdminTableRow[] = useMemo(() => rows.map((session) => ({
    ...session,
    title: `${session.tutorName} / ${session.studentName}`,
    subtitle: `${session.subjectName} | ${new Date(session.startTime).toLocaleString()}`,
    metadata: `${session.tokenAmount} tokens | ${session.durationHours} hrs | escrow ${session.escrow?.status || 'none'}`,
  })), [rows]);

  const runAction = async (id: string, action: () => Promise<unknown>, patch: Partial<AdminSessionRow>) => {
    const before = rows;
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    try {
      await action();
    } catch (err) {
      setRows(before);
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Sessions</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Monitor bookings, escrow, payment state, cancellations, and disputes.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Completion rate</p><p className="mt-1 text-2xl font-bold text-white">{metrics.completionRate ?? 0}%</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Cancellation rate</p><p className="mt-1 text-2xl font-bold text-white">{metrics.cancellationRate ?? 0}%</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Avg duration</p><p className="mt-1 text-2xl font-bold text-white">{metrics.avgSessionDurationHours ?? 0} hrs</p></div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-5">
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Tutor ID" onChange={(e) => setFilters((f) => ({ ...f, page: 1, tutor: e.target.value || undefined }))} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Student ID" onChange={(e) => setFilters((f) => ({ ...f, page: 1, student: e.target.value || undefined }))} />
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Subject ID" onChange={(e) => setFilters((f) => ({ ...f, page: 1, subject: e.target.value || undefined }))} />
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => setFilters((f) => ({ ...f, page: 1, status: e.target.value || undefined }))}>
          <option value="">Any status</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="declined">Declined</option>
        </select>
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" type="date" onChange={(e) => setFilters((f) => ({ ...f, page: 1, date: e.target.value || undefined }))} />
      </div>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <AdminDataTable
        title={isLoading ? 'Sessions loading...' : `Sessions (${pagination.total})`}
        rows={tableRows}
        renderActions={(row) => {
          const session = rows.find((item) => item.id === row.id)!;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="text-xs font-semibold text-indigo-200" onClick={() => setSelected(session)}>Inspect</button>
              <button className="text-xs font-semibold text-amber-200" onClick={() => runAction(session.id, () => adminApi.cancelAdminSession(session.id), { status: 'cancelled' })}>Cancel</button>
              <button className="text-xs font-semibold text-emerald-200" onClick={() => runAction(session.id, () => adminApi.resolveSessionDispute(session.id, 'release'), { status: 'completed' })}>Release</button>
              <button className="text-xs font-semibold text-cyan-200" onClick={() => runAction(session.id, () => adminApi.resolveSessionDispute(session.id, 'refund'), { status: 'cancelled' })}>Refund</button>
            </div>
          );
        }}
      />

      <div className="flex items-center justify-between text-sm text-slate-300">
        <button disabled={pagination.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}>Previous</button>
        <span>Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}</span>
        <button disabled={pagination.page * pagination.pageSize >= pagination.total} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}>Next</button>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold">{selected.subjectName}</h2>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <p>Tutor: {selected.tutorName}</p><p>Student: {selected.studentName}</p>
              <p>Tokens: {selected.tokenAmount}</p><p>KSH: {selected.amountKes}</p>
              <p>Escrow: {selected.escrow?.status || 'none'}</p><p>Payment: {selected.payment.status}</p>
            </div>
            <button className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
