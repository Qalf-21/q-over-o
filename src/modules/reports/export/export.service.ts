import type { ExportFormat, ReportColumn, ReportData, ReportRow } from '../core/report.types';
import { generateCsv } from './csv.generator';
import { generatePdfHtml } from './pdf.generator';

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportReport = <T extends ReportRow>(
  title: string,
  format: ExportFormat,
  data: ReportData<T>,
  columns: ReportColumn<T>[],
  role: string,
) => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (format === 'PDF') {
    const html = generatePdfHtml(title, data, columns, role);
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    } else {
      downloadText(html, `${slug}.html`, 'text/html;charset=utf-8');
    }
    return;
  }

  const csv = generateCsv(data.rows, columns);
  downloadText(csv, `${slug}.${format === 'EXCEL' ? 'xls' : 'csv'}`, format === 'EXCEL' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8');
};
