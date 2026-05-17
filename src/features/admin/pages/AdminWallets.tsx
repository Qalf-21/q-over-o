import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { AdminDataTable } from '../components/AdminDataTable';
import type { AdminListParams, AdminPagination, AdminTableRow, AdminWalletRow } from '../types/admin';

const pageSize = 20;

export const AdminWallets: React.FC = () => {
  const [rows, setRows] = useState<AdminWalletRow[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({ page: 1, pageSize, total: 0 });
  const [filters, setFilters] = useState<AdminListParams>({ page: 1, pageSize });
  const [selected, setSelected] = useState<AdminWalletRow | null>(null);
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
        return adminApi.getManagedWallets(filters);
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows);
          setPagination(data.pagination);
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load wallets'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    balanceTokens: sum.balanceTokens + row.balanceTokens,
    lockedTokens: sum.lockedTokens + row.escrowLockedTokens,
    purchasesKes: sum.purchasesKes + row.purchaseKes,
    payoutsTokens: sum.payoutsTokens + row.payoutCompletedTokens,
  }), { balanceTokens: 0, lockedTokens: 0, purchasesKes: 0, payoutsTokens: 0 }), [rows]);

  const tableRows: AdminTableRow[] = useMemo(() => rows.map((wallet) => ({
    ...wallet,
    metadata: `${wallet.balanceTokens} tokens | KSH ${wallet.balanceKes} | locked ${wallet.escrowLockedTokens}`,
  })), [rows]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Wallets</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Token balances, purchases, escrow, refunds, and payout qualification state.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Balances</p><p className="mt-1 text-2xl font-bold text-white">{totals.balanceTokens} tkn</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Escrow locked</p><p className="mt-1 text-2xl font-bold text-white">{totals.lockedTokens} tkn</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Purchases</p><p className="mt-1 text-2xl font-bold text-white">KSH {totals.purchasesKes}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Paid out</p><p className="mt-1 text-2xl font-bold text-white">{totals.payoutsTokens} tkn</p></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <input className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white md:max-w-sm" placeholder="Search wallet owner" onChange={(e) => setFilters((f) => ({ ...f, page: 1, search: e.target.value }))} />
        <p className="mt-3 text-xs text-slate-400">1 KSH = 10 tokens. Minimum top-up is 1 KSH. Tutor payouts unlock only after 30 hrs, 3/5 rating, and 20 unique student reviewers.</p>
      </div>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <AdminDataTable
        title={isLoading ? 'Wallets loading...' : `Wallets (${pagination.total})`}
        rows={tableRows}
        renderActions={(row) => {
          const wallet = rows.find((item) => item.id === row.id)!;
          return <button className="text-xs font-semibold text-indigo-200" onClick={() => setSelected(wallet)}>Inspect</button>;
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
            <p className="text-sm text-slate-400">{selected.subtitle}</p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <p>Balance: {selected.balanceTokens} tokens</p><p>KSH: {selected.balanceKes}</p>
              <p>Purchases: {selected.purchaseTokens} tokens</p><p>Refunds: {selected.refundTokens} tokens</p>
              <p>Escrow locked: {selected.escrowLockedTokens}</p><p>Disputed: {selected.escrowDisputedTokens}</p>
              <p>Payout pending: {selected.payoutPendingTokens}</p><p>Payout completed: {selected.payoutCompletedTokens}</p>
              <p>Withdrawable: {selected.withdrawableUnlocked ? 'Unlocked' : 'Restricted'}</p><p>Status: {selected.payoutQualificationStatus}</p>
            </div>
            <button className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
