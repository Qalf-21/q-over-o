import type React from 'react';
import { Activity, Star, TrendingUp, Wallet } from 'lucide-react';
import type { ReportSummaryMetric, ReportValueFormat } from '../core/report.types';

interface ReportSummaryCardsProps {
  metrics: ReportSummaryMetric[];
  variant?: 'default' | 'admin';
}

const icons = [Activity, Wallet, TrendingUp, Star];

const formatValue = (value: number | string, format: ReportValueFormat = 'number') => {
  if (typeof value === 'string') return value;
  if (format === 'currency') return `KES ${value.toLocaleString()}`;
  if (format === 'tokens') return `${value.toLocaleString()} tokens`;
  if (format === 'hours') return `${value.toLocaleString()} hrs`;
  if (format === 'percent') return `${value.toLocaleString()}%`;
  if (format === 'rating') return value.toFixed(1);
  return value.toLocaleString();
};

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ metrics, variant = 'default' }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {metrics.map((metric, index) => {
      const Icon = icons[index % icons.length];
      return (
        <div key={metric.key} className={variant === 'admin' ? 'rounded-2xl border border-white/10 bg-white/[0.06] p-4' : 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm'}>
          <div className="flex items-center justify-between">
            <p className={variant === 'admin' ? 'text-xs font-medium text-slate-400' : 'text-xs font-medium text-gray-500'}>{metric.label}</p>
            <Icon className={variant === 'admin' ? 'h-5 w-5 text-indigo-200' : 'h-5 w-5 text-indigo-500'} />
          </div>
          <p className={variant === 'admin' ? 'mt-3 text-2xl font-bold text-white' : 'mt-3 text-2xl font-bold text-gray-900'}>
            {formatValue(metric.value, metric.format)}
          </p>
        </div>
      );
    })}
  </div>
);
