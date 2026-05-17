import React, { useEffect, useState } from 'react';
import { AdminDataTable } from '../components/AdminDataTable';
import type { AdminTableRow } from '../types/admin';

interface AdminSectionPageProps {
  title: string;
  description: string;
  loadRows?: () => Promise<AdminTableRow[]>;
}

export const AdminSectionPage: React.FC<AdminSectionPageProps> = ({
  title,
  description,
  loadRows,
}) => {
  const [rows, setRows] = useState<AdminTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(loadRows));

  useEffect(() => {
    if (!loadRows) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setIsLoading(true);
      try {
        const data = await loadRows();
        if (!cancelled) setRows(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [loadRows]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
      </div>

      <AdminDataTable
        title={isLoading ? `${title} loading...` : title}
        rows={rows}
        emptyText={loadRows ? 'No records found' : 'This module is ready for workflow-specific controls.'}
      />
    </div>
  );
};
