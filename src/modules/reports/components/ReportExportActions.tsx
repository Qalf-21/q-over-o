import type React from 'react';
import { FileDown } from 'lucide-react';
import type { ExportFormat } from '../core/report.types';
import { EXPORT_FORMATS } from '../core/report.constants';

interface ReportExportActionsProps {
  onExport: (format: ExportFormat) => void;
}

export const ReportExportActions: React.FC<ReportExportActionsProps> = ({ onExport }) => (
  <div className="flex flex-wrap gap-2">
    {EXPORT_FORMATS.map((format) => (
      <button
        key={format}
        type="button"
        onClick={() => onExport(format)}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        <FileDown className="h-4 w-4" />
        {format}
      </button>
    ))}
  </div>
);
