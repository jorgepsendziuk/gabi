import type { TableMeta } from '@gabi/core';

/** Chaves típicas ODK Central / Aggregate (ordem de prioridade). */
export const ODK_KEY_COLUMNS = ['_uri', '_uuid', '_id', 'uuid', 'id'];

export function resolveRecordKeyColumn(
  table: TableMeta,
  explicit?: string,
): string {
  if (explicit && table.columns.some((c) => c.name === explicit)) {
    return explicit;
  }
  for (const candidate of ODK_KEY_COLUMNS) {
    const col = table.columns.find((c) => c.name.toLowerCase() === candidate);
    if (col) return col.name;
  }
  if (table.primaryKey.length === 1) return table.primaryKey[0]!;
  throw new Error(
    `Não foi possível determinar chave do registro para ${table.schema}.${table.name}`,
  );
}

export function buildRecordKeyJson(
  row: Record<string, unknown>,
  keyColumn: string,
): Record<string, unknown> {
  const value = row[keyColumn];
  if (value === undefined || value === null) {
    throw new Error(`Coluna chave "${keyColumn}" ausente no registro`);
  }
  return { [keyColumn]: value };
}

/** Lê valor da chave no registro (case-insensitive no nome da coluna). */
export function getRecordKeyValue(
  row: Record<string, unknown>,
  preferredColumn: string,
): { column: string; value: unknown } | null {
  const candidates = [
    preferredColumn,
    ...ODK_KEY_COLUMNS.filter((c) => c.toLowerCase() !== preferredColumn.toLowerCase()),
  ];
  for (const candidate of candidates) {
    const col = Object.keys(row).find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (col != null && row[col] !== undefined && row[col] !== null && row[col] !== '') {
      return { column: col, value: row[col] };
    }
  }
  return null;
}

/** Ajusta coluna chave a partir de uma linha real (útil quando meta está desatualizada). */
export function detectRecordKeyColumnFromRow(
  row: Record<string, unknown>,
  preferred?: string,
): string | null {
  const hit = getRecordKeyValue(row, preferred ?? '_uuid');
  return hit?.column ?? null;
}

export function recordKeyToString(recordKeyJson: Record<string, unknown>): string {
  const keys = Object.keys(recordKeyJson).sort();
  return keys.map((k) => `${k}=${String(recordKeyJson[k])}`).join('|');
}

export function parseRecordKeyString(recordKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const part of recordKey.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    const num = Number(v);
    out[k] = Number.isNaN(num) || v === '' ? v : num;
  }
  return out;
}
