export interface ReportColumn {
  field: string;
  header: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toLocaleString('pt-BR');
    return JSON.stringify(value);
  }
  return String(value);
}

function getField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const key = Object.keys(row).find((k) => k.toLowerCase() === field.toLowerCase());
  return key ? row[key] : undefined;
}

function buildDataTable(
  records: Record<string, unknown>[],
  columns: ReportColumn[],
): string {
  if (records.length === 0) {
    return '<p class="gabi-report-empty"><em>Nenhum registro para exibir.</em></p>';
  }

  const cols =
    columns.length > 0
      ? columns
      : Object.keys(records[0] ?? {})
          .filter((k) => k !== '_gabi')
          .slice(0, 12)
          .map((k) => ({ field: k, header: k }));

  const head = cols.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const rows = records
    .map((row) => {
      const cells = cols
        .map((c) => `<td>${escapeHtml(formatValue(getField(row, c.field)))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table class="gabi-report-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderReportPreview(
  bodyHtml: string,
  records: Record<string, unknown>[],
  columns: ReportColumn[],
  options: {
    label: string;
    tableName?: string;
    showDataTable?: boolean;
    maxRows?: number;
  },
): string {
  const maxRows = options.maxRows ?? 100;
  const slice = records.slice(0, maxRows);
  let html = bodyHtml;

  html = html.replace(/\{\{__date__\}\}/gi, escapeHtml(new Date().toLocaleString('pt-BR')));
  html = html.replace(/\{\{__title__\}\}/gi, escapeHtml(options.label));
  html = html.replace(/\{\{__table__\}\}/gi, escapeHtml(options.tableName ?? ''));

  const first = slice[0];
  if (first) {
    for (const key of Object.keys(first)) {
      if (key === '_gabi') continue;
      const pattern = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'gi');
      html = html.replace(pattern, escapeHtml(formatValue(getField(first, key))));
    }
  }

  if (options.showDataTable !== false) {
    html += `<section class="gabi-report-data">${buildDataTable(slice, columns)}</section>`;
  }

  return html;
}
