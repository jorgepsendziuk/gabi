import type { OdkFormField } from './parse-xform.js';

/** Mapa nome da coluna no BD → label humano do XForm. */
export function odkFieldsToColumnLabels(fields: OdkFormField[]): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const f of fields) {
    if (!f.label?.trim()) continue;
    const label = f.label.trim();
    if (f.dbColumn) {
      labels[f.dbColumn] = label;
      labels[f.dbColumn.toUpperCase()] = label;
      labels[f.dbColumn.toLowerCase()] = label;
    }
    labels[f.name] = label;
    labels[f.name.toLowerCase()] = label;
    labels[f.name.toUpperCase()] = label;
  }

  return labels;
}

export function resolveOdkColumnLabel(
  columnName: string,
  labels?: Record<string, string>,
): string {
  if (!labels || !columnName) return columnName;
  return (
    labels[columnName] ??
    labels[columnName.toUpperCase()] ??
    labels[columnName.toLowerCase()] ??
    columnName
  );
}
