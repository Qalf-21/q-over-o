import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { AdminDataTable } from '../components/AdminDataTable';
import type { AdminListParams, AdminPagination, AdminTableRow, AdminUserRow } from '../types/admin';

const pageSize = 20;

export const AdminUsers: React.FC = () => {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({ page: 1, pageSize, total: 0 });
  const [filters, setFilters] = useState<AdminListParams>({ page: 1, pageSize, sortBy: 'created_at', sortDir: 'desc' });
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
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
        return adminApi.getManagedUsers(filters);
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows);
          setPagination(data.pagination);
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const tableRows: AdminTableRow[] = useMemo(() => rows.map((user) => ({
    ...user,
    status: user.isSuspended ? 'suspended' : user.adminRole ? `admin: ${user.adminRole}` : 'active',
    metadata: `${user.role} | ${user.isVerified ? 'verified' : 'unverified'} | ${user.wallet.balanceTokens} tokens`,
  })), [rows]);

  const patchRow = (id: string, patch: Partial<AdminUserRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const runAction = async (id: string, action: () => Promise<unknown>, patch?: Partial<AdminUserRow>, remove = false) => {
    const before = rows;
    if (remove) setRows((current) => current.filter((row) => row.id !== id));
    else if (patch) patchRow(id, patch);
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
        <h1 className="mt-1 text-3xl font-bold text-white">Users</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage learner, tutor, wallet, review, and admin access state.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-6">
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="Search users" onChange={(e) => setFilters((f) => ({ ...f, page: 1, search: e.target.value }))} />
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => setFilters((f) => ({ ...f, page: 1, role: e.target.value || undefined }))}>
          <option value="">All roles</option><option value="tutee">Tutee</option><option value="tutor">Tutor</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => setFilters((f) => ({ ...f, page: 1, active: e.target.value ? e.target.value === 'active' : undefined }))}>
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => setFilters((f) => ({ ...f, page: 1, verified: e.target.value ? e.target.value === 'true' : undefined }))}>
          <option value="">Any verification</option><option value="true">Verified</option><option value="false">Unverified</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => setFilters((f) => ({ ...f, page: 1, recentDays: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">Any date</option><option value="7">Recent users</option><option value="30">Last 30 days</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" onChange={(e) => {
          const [sortBy, sortDir] = e.target.value.split(':');
          setFilters((f) => ({ ...f, page: 1, sortBy, sortDir: sortDir as 'asc' | 'desc' }));
        }}>
          <option value="created_at:desc">Newest</option><option value="created_at:asc">Oldest</option><option value="name:asc">Name</option><option value="email:asc">Email</option><option value="role:asc">Role</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <AdminDataTable
        title={isLoading ? 'Users loading...' : `Users (${pagination.total})`}
        rows={tableRows}
        renderActions={(row) => {
          const user = rows.find((item) => item.id === row.id)!;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="text-xs font-semibold text-indigo-200" onClick={() => setSelected(user)}>View</button>
              <button className="text-xs font-semibold text-amber-200" onClick={() => runAction(user.id, () => user.isSuspended ? adminApi.reactivateUser(user.id) : adminApi.suspendUser(user.id), { isSuspended: !user.isSuspended })}>{user.isSuspended ? 'Reactivate' : 'Suspend'}</button>
              <button className="text-xs font-semibold text-emerald-200" onClick={() => runAction(user.id, () => user.adminRole ? adminApi.revokeAdmin(user.id) : adminApi.promoteAdmin(user.id), { adminRole: user.adminRole ? null : 'support_admin' })}>{user.adminRole ? 'Revoke admin' : 'Promote'}</button>
              <button className="text-xs font-semibold text-red-200" onClick={() => runAction(user.id, () => adminApi.deleteUser(user.id), undefined, true)}>Delete</button>
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
            <h2 className="text-xl font-bold">{selected.title}</h2>
            <p className="text-sm text-slate-400">{selected.email}</p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <p>Role: {selected.role}</p><p>Admin: {selected.adminRole || 'No'}</p>
              <p>Wallet: {selected.wallet.balanceTokens} tokens</p><p>Sessions: {selected.sessionsCount}</p>
              <p>Reviews: {selected.reviewsCount}</p><p>Verified: {selected.isVerified ? 'Yes' : 'No'}</p>
              <p>Spending: {selected.totalSpendingTokens} tokens</p><p>Earnings: {selected.totalEarningsTokens} tokens</p>
            </div>
            <button className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
