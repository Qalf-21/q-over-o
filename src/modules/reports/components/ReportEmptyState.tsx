import type React from 'react';
import { FileSearch } from 'lucide-react';

export const ReportEmptyState: React.FC<{ message?: string; variant?: 'default' | 'admin' }> = ({
  message = 'No report records match the current filters.',
  variant = 'default',
}) => (
  <div className={variant === 'admin' ? 'rounded-2xl border border-white/10 bg-white/[0.06] p-10 text-center' : 'rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm'}>
    <FileSearch className={variant === 'admin' ? 'mx-auto h-10 w-10 text-slate-500' : 'mx-auto h-10 w-10 text-gray-400'} />
    <p className={variant === 'admin' ? 'mt-3 text-sm font-medium text-slate-300' : 'mt-3 text-sm font-medium text-gray-600'}>{message}</p>
  </div>
);
