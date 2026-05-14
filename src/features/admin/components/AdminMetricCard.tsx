// src/features/admin/components/AdminMetricCard.tsx — FULL REPLACEMENT
//
// Enhancements:
//  • Skeleton loading state
//  • Optional sub-label beneath the value (e.g. "↑ 12 this week")
//  • Matches existing slate-950 dark aesthetic exactly

import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface AdminMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  subLabel?: string;
  isLoading?: boolean;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  accent,
  subLabel,
  isLoading = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl"
  >
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {isLoading ? (
          <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-white/10" />
        ) : (
          <p className="mt-2 text-3xl font-bold text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
        {subLabel && !isLoading && (
          <p className="mt-1 text-xs text-slate-500">{subLabel}</p>
        )}
        {isLoading && subLabel !== undefined && (
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-white/10" />
        )}
      </div>
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);
