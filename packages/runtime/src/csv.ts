export function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function escapeCsvCell(value: unknown): string {
  const raw = formatCsvCell(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function rowsToCsv(header: string[], rows: Record<string, unknown>[], fields: string[]): string {
  const headerLine = header.map(escapeCsvCell).join(',');
  const lines = rows.map((row) => fields.map((f) => escapeCsvCell(row[f])).join(','));
  return [headerLine, ...lines].join('\n');
}
