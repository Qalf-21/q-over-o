// src/features/admin/components/AdminMiniChart.tsx
//
// Pure-SVG sparkline + full area chart panel.
// Zero additional dependencies — works with whatever is already installed.

import React, { useMemo } from 'react';
import type { DailyPoint } from '../hooks/useAdminOverview';

interface AdminMiniChartProps {
  title: string;
  subtitle?: string;
  data: DailyPoint[];
  color?: string;      // tailwind gradient start, e.g. "indigo"
  formatValue?: (v: number) => string;
  isLoading?: boolean;
  height?: number;
}

const GRADIENTS: Record<string, { stroke: string; fill: string }> = {
  indigo:   { stroke: '#6366f1', fill: 'rgba(99,102,241,0.18)' },
  emerald:  { stroke: '#10b981', fill: 'rgba(16,185,129,0.18)' },
  sky:      { stroke: '#0ea5e9', fill: 'rgba(14,165,233,0.18)' },
  amber:    { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.18)' },
  fuchsia:  { stroke: '#d946ef', fill: 'rgba(217,70,239,0.18)' },
  rose:     { stroke: '#f43f5e', fill: 'rgba(244,63,94,0.18)' },
};

function Sparkline({
  data,
  color = 'indigo',
  width = 300,
  height = 80,
}: {
  data: DailyPoint[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const palette = GRADIENTS[color] ?? GRADIENTS.indigo;

  const points = useMemo(() => {
    if (data.length === 0) return { line: '', area: '', dots: [] };
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const pad = 4;

    const coords = data.map((d, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2);
      const y = pad + ((max - d.value) / range) * (height - pad * 2);
      return { x, y, v: d.value };
    });

    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
    const area = `${line} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;

    return { line, area, dots: coords };
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-xs text-slate-600"
      >
        No data
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <path d={points.area} fill={palette.fill} />
      <path d={points.line} fill="none" stroke={palette.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.dots.slice(-1).map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill={palette.stroke} />
      ))}
    </svg>
  );
}

export const AdminMiniChart: React.FC<AdminMiniChartProps> = ({
  title,
  subtitle,
  data,
  color = 'indigo',
  formatValue = (v) => v.toLocaleString(),
  isLoading = false,
  height = 80,
}) => {
  const latest = data[data.length - 1]?.value ?? 0;
  const prev   = data[data.length - 2]?.value ?? 0;
  const delta  = latest - prev;
  const pct    = prev > 0 ? ((delta / prev) * 100).toFixed(1) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {!isLoading && (
          <div className="text-right">
            <p className="text-lg font-bold text-white">{formatValue(latest)}</p>
            {pct !== null && (
              <p className={`text-xs ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(Number(pct))}% vs prev day
              </p>
            )}
          </div>
        )}
        {isLoading && (
          <div className="space-y-1 text-right">
            <div className="h-5 w-16 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-10 animate-pulse rounded bg-white/10" />
          </div>
        )}
      </div>

      {isLoading ? (
        <div
          style={{ height }}
          className="animate-pulse rounded-xl bg-white/[0.04]"
        />
      ) : (
        <Sparkline data={data} color={color} height={height} />
      )}

      {/* X-axis labels: first and last date */}
      {!isLoading && data.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-slate-600">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      )}
    </div>
  );
};
