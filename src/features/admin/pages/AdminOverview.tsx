import React, { useEffect, useState } from 'react';
import { Activity, MessageSquare, Users, Wallet, Shield } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';
import { AdminMetricCard } from '../components/AdminMetricCard';
import type { AdminOverview as AdminOverviewData } from '../types/admin';

export const AdminOverview: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApi.getOverview()
      .then((response) => {
        if (!cancelled) setOverview(response.data || null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const totals = overview?.totals;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Platform Overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Monitor Q-over-o operations, risk signals, wallet activity, and audit events.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard title="Users" value={isLoading ? '-' : totals?.users ?? 0} icon={Users} accent="bg-gradient-to-br from-indigo-500 to-purple-600" />
        <AdminMetricCard title="Tutors" value={isLoading ? '-' : totals?.tutors ?? 0} icon={Shield} accent="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <AdminMetricCard title="Sessions" value={isLoading ? '-' : totals?.sessions ?? 0} icon={Activity} accent="bg-gradient-to-br from-sky-500 to-indigo-600" />
        <AdminMetricCard title="Wallets" value={isLoading ? '-' : totals?.wallets ?? 0} icon={Wallet} accent="bg-gradient-to-br from-amber-500 to-pink-600" />
        <AdminMetricCard title="Reviews" value={isLoading ? '-' : totals?.reviews ?? 0} icon={MessageSquare} accent="bg-gradient-to-br from-fuchsia-500 to-purple-600" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
        <h2 className="text-lg font-bold text-white">Recent Audit Events</h2>
        <div className="mt-4 space-y-3">
          {(overview?.recentLogs || []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-400">
              No audit events yet
            </p>
          ) : (
            overview!.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{log.action}</p>
                  <p className="text-xs text-slate-400">{log.target_type} {log.target_id || ''}</p>
                </div>
                <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
