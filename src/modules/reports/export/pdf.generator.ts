import type { ReportColumn, ReportData, ReportRow } from '../core/report.types';

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char));

export const generatePdfHtml = <T extends ReportRow>(
  title: string,
  data: ReportData<T>,
  columns: ReportColumn<T>[],
  role: string,
) => {
  const generatedAt = new Date(data.exportMetadata.generatedAt).toLocaleString();
  const filterText = Object.entries(data.filtersApplied)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ') || 'No filters';

  return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 32px; }
    header { border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { color: #4f46e5; font-weight: 800; font-size: 20px; }
    h1 { margin: 8px 0 4px; font-size: 24px; }
    .meta { color: #6b7280; font-size: 12px; line-height: 1.6; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .label { color: #6b7280; font-size: 11px; text-transform: uppercase; }
    .value { font-size: 20px; font-weight: 800; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #eef2ff; color: #3730a3; text-align: left; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; vertical-align: top; }
    footer { margin-top: 24px; color: #6b7280; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">Q-over-o</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated: ${escapeHtml(generatedAt)}<br>Role: ${escapeHtml(role)}<br>Filters: ${escapeHtml(filterText)}</div>
  </header>
  <section class="summary">
    ${data.summary.map((item) => `<div class="card"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(item.value)}</div></div>`).join('')}
  </section>
  <table>
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
    <tbody>
      ${data.rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <footer>Q-over-o Reporting System | Generated ${escapeHtml(generatedAt)} | Page 1</footer>
</body>
</html>`;
};
