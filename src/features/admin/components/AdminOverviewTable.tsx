// src/features/admin/components/AdminOverviewTable.tsx
//
// Generic table used for Recent Users, Recent Sessions,
// Recent Payments, and Flagged Reviews on the overview page.

import React from 'react';
import { motion } from 'framer-motion';

export interface TableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface AdminOverviewTableProps<T> {
  title: string;
  rows: T[];
  columns: TableColumn<T>[];
  keyExtractor: (row: T) => string;
  emptyText?: string;
  isLoading?: boolean;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
        </td>
      ))}
    </tr>
  );
}

export function AdminOverviewTable<T>({
  title,
  rows,
  columns,
  keyExtractor,
  emptyText = 'No records found',
  isLoading = false,
}: AdminOverviewTableProps<T>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-slate-950/30 backdrop-blur-xl"
    >
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/[0.03]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {isLoading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))}
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-10 text-center text-sm text-slate-500"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="transition-colors hover:bg-white/[0.04]"
                >
                  {columns.map((col) => (
                    <td key={col.header} className={`px-5 py-4 ${col.className ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ── Status badge helper used in multiple tables ───────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  completed:  'bg-emerald-500/10 border-emerald-400/30 text-emerald-200',
  confirmed:  'bg-sky-500/10 border-sky-400/30 text-sky-200',
  pending:    'bg-amber-500/10 border-amber-400/30 text-amber-200',
  cancelled:  'bg-rose-500/10 border-rose-400/30 text-rose-200',
  failed:     'bg-rose-500/10 border-rose-400/30 text-rose-200',
  available:  'bg-emerald-500/10 border-emerald-400/30 text-emerald-200',
  tutor:      'bg-indigo-500/10 border-indigo-400/30 text-indigo-200',
  tutee:      'bg-purple-500/10 border-purple-400/30 text-purple-200',
  published:  'bg-indigo-500/10 border-indigo-400/30 text-indigo-200',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toLowerCase()]
    ?? 'bg-white/5 border-white/10 text-slate-300';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}
