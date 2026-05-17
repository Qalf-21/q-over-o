import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReportChartSeries } from '../core/report.types';

interface ReportChartSectionProps {
  charts: ReportChartSeries[];
  variant?: 'default' | 'admin';
}

export const ReportChartSection: React.FC<ReportChartSectionProps> = ({ charts, variant = 'default' }) => {
  if (!charts.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((chart) => {
        const axisColor = variant === 'admin' ? '#94a3b8' : '#6b7280';
        const gridColor = variant === 'admin' ? '#334155' : '#e5e7eb';
        return (
          <div key={chart.key} className={variant === 'admin' ? 'rounded-2xl border border-white/10 bg-white/[0.06] p-5' : 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm'}>
            <h2 className={variant === 'admin' ? 'text-base font-bold text-white' : 'text-base font-bold text-gray-900'}>{chart.title}</h2>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                {chart.type === 'bar' ? (
                  <BarChart data={chart.data}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis stroke={axisColor} tickLine={false} axisLine={false} width={40} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chart.data}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis stroke={axisColor} tickLine={false} axisLine={false} width={40} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className={variant === 'admin' ? 'mt-2 flex justify-between text-xs text-slate-500' : 'mt-2 flex justify-between text-xs text-gray-400'}>
              <span>{chart.data[0]?.label || '-'}</span>
              <span>{chart.data.at(-1)?.label || '-'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
