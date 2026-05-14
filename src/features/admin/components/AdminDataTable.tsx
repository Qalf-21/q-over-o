import React from 'react';
import type { AdminTableRow } from '../types/admin';

interface AdminDataTableProps {
  title: string;
  rows: AdminTableRow[];
  emptyText?: string;
}

export const AdminDataTable: React.FC<AdminDataTableProps> = ({
  title,
  rows,
  emptyText = 'No records found',
}) => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-slate-950/30 backdrop-blur-xl">
    <div className="border-b border-white/10 px-5 py-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/10">
        <thead className="bg-white/[0.03]">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Record</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Metadata</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-center text-sm text-slate-400" colSpan={4}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-white/[0.04]">
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-white">{row.title}</p>
                  <p className="text-xs text-slate-400">{row.subtitle}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                    {row.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-300">{row.metadata || '-'}</td>
                <td className="px-5 py-4 text-sm text-slate-400">
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
