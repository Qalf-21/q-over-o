import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TokenDisplayProps {
  label: string;
  amount: number;
  subtitle?: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  variant?: 'default' | 'large' | 'compact';
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  label,
  amount,
  subtitle,
  trend,
  trendValue,
  variant = 'default'
}) => {
  if (variant === 'large') {
    return (
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-indigo-100 font-medium">{label}</span>
          <Wallet className="w-6 h-6 text-indigo-200" />
        </div>
        <div className="text-4xl font-bold mb-2">{amount.toLocaleString()}</div>
        <div className="text-indigo-200 text-sm">tokens</div>
        {(trend || subtitle) && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            {trend && (
              <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
                {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {trendValue}
              </span>
            )}
            {subtitle && <span className="text-indigo-200">{subtitle}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <Wallet className="w-4 h-4 text-gray-400" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{amount.toLocaleString()}</div>
      <div className="text-xs text-gray-400 mt-1">tokens</div>
    </div>
  );
};