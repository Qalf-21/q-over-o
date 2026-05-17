import type React from 'react';

export const ReportLoadingSkeleton: React.FC<{ variant?: 'default' | 'admin' }> = ({ variant = 'default' }) => {
  const shimmer = variant === 'admin' ? 'bg-white/10' : 'bg-gray-100';
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className={`h-28 animate-pulse rounded-2xl ${shimmer}`} />)}
      </div>
      <div className={`h-64 animate-pulse rounded-2xl ${shimmer}`} />
      <div className={`h-80 animate-pulse rounded-2xl ${shimmer}`} />
    </div>
  );
};
