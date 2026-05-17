import type React from 'react';
import { Download } from 'lucide-react';
import type { ExportFormat } from '../core/report.types';
import { EXPORT_FORMATS } from '../core/report.constants';

interface ReportHeaderProps {
  title: string;
  subtitle: string;
  generatedAt?: string;
  onExport: (format: ExportFormat) => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ title, subtitle, generatedAt, onExport }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Reports</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">{subtitle}</p>
      {generatedAt && <p className="mt-2 text-xs text-gray-400">Generated {new Date(generatedAt).toLocaleString()}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => onExport(format)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-700"
        >
          <Download className="h-4 w-4" />
          {format}
        </button>
      ))}
    </div>
  </div>
);
