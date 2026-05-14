import React, { useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import type { AdminLog } from '../types/admin';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    adminApi.getAuditLogs().then((data) => {
      if (!cancelled) setLogs(data);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Audit Logs</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Immutable operational trail for sensitive admin actions.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Action</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Target</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Metadata</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-slate-400" colSpan={4}>
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-white/[0.04]">
                    <td className="px-5 py-4 text-sm font-semibold text-white">{log.action}</td>
                    <td className="px-5 py-4 text-sm text-slate-300">{log.target_type} {log.target_id || ''}</td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {JSON.stringify(log.metadata || {})}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
