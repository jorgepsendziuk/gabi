const ODK_KEY_COLUMNS = ['_uri', '_uuid', '_id', 'uuid', 'id'];

function getRecordKeyValue(
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

function recordKeyToString(recordKeyJson: Record<string, unknown>): string {
  const keys = Object.keys(recordKeyJson).sort();
  return keys.map((k) => `${k}=${String(recordKeyJson[k])}`).join('|');
}

/** ID de registro para URL (compatível com `resolveRecordKeyFromId` na API). */
export function rowToRecordId(
  row: Record<string, unknown>,
  preferredKey?: string,
): string | null {
  const hit = getRecordKeyValue(row, preferredKey ?? '_uuid');
  if (!hit) return null;
  return encodeURIComponent(String(hit.value));
}

export function rowToRecordKeyString(
  row: Record<string, unknown>,
  preferredKey?: string,
): string | null {
  const hit = getRecordKeyValue(row, preferredKey ?? '_uuid');
  if (!hit) return null;
  return encodeURIComponent(recordKeyToString({ [hit.column]: hit.value }));
}
