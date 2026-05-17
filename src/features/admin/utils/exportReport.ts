import type { AdminReportRow } from '../types/admin';

const headers = ['Label', 'Group', 'Metric', 'Value', 'Tokens', 'KSH', 'Status', 'Date'];

const cells = (row: AdminReportRow) => [
  row.label,
  row.group,
  row.metric,
  row.value,
  row.amountTokens,
  row.amountKes,
  row.status,
  new Date(row.date).toLocaleString(),
];

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportReport = (rows: AdminReportRow[], title: string, format: 'csv' | 'excel' | 'pdf') => {
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (format === 'csv') {
    const body = [headers, ...rows.map(cells)].map((row) => row.map(escapeCsv).join(',')).join('\n');
    download(new Blob([body], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }

  const html = `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${cells(row).map((c) => `<td>${String(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;

  if (format === 'excel') {
    download(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${filename}.xls`);
    return;
  }

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>${title}</h1>${html}</body></html>`);
  win.document.close();
  win.print();
};
