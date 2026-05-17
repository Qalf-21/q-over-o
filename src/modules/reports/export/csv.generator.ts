import type { ReportColumn, ReportRow } from '../core/report.types';

const csvValue = (value: unknown) => {
  const raw = value === undefined || value === null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

export const generateCsv = <T extends ReportRow>(rows: T[], columns: ReportColumn<T>[]) => {
  const exportable = columns.filter((column) => column.key !== 'actions');
  const header = exportable.map((column) => csvValue(column.label)).join(',');
  const body = rows.map((row) => exportable.map((column) => csvValue(row[column.key])).join(',')).join('\n');
  return [header, body].filter(Boolean).join('\n');
};
