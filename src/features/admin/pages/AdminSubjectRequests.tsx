import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';
import { AdminDataTable } from '../components/AdminDataTable';
import type { AdminTableRow } from '../types/admin';

export const AdminSubjectRequests: React.FC = () => {
  const [rows, setRows] = useState<AdminTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await adminApi.getSubjectRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subject requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const handleApprove = async (id: string) => {
    setActiveId(id);
    setError(null);
    try {
      await adminApi.approveSubjectRequest(id);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve subject request');
    } finally {
      setActiveId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActiveId(id);
    setError(null);
    try {
      await adminApi.rejectSubjectRequest(id);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject subject request');
    } finally {
      setActiveId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Subject Requests</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Review tutor-requested subjects before they become bookable marketplace subjects.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <AdminDataTable
        title={isLoading ? 'Subject requests loading...' : 'Subject Requests'}
        rows={rows}
        emptyText="No subject requests found"
        renderActions={(row) => {
          const isPending = row.status === 'pending';
          const isActive = activeId === row.id;

          if (!isPending) {
            return <span className="text-xs text-slate-500">Reviewed</span>;
          }

          return (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleApprove(row.id)}
                disabled={Boolean(activeId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
              >
                {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReject(row.id)}
                disabled={Boolean(activeId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          );
        }}
      />
    </div>
  );
};
