import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'indigo' | 'purple' | 'green' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'indigo'
}) => {
  const colorSchemes = {
    indigo: 'from-indigo-500 to-indigo-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600'
  };

  

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden`}
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colorSchemes[color]}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorSchemes[color]} text-white flex items-center justify-center shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
};