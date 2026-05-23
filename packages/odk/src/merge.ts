import type { GabiRecordMeta, OdkChange, OdkChangeOperation } from '@gabi/core';

export interface MergedRecord {
  data: Record<string, unknown>;
  meta: GabiRecordMeta;
}

function latestChangesByKey(changes: OdkChange[]): Map<string, OdkChange[]> {
  const map = new Map<string, OdkChange[]>();
  const sorted = [...changes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  for (const ch of sorted) {
    const list = map.get(ch.recordKey) ?? [];
    list.push(ch);
    map.set(ch.recordKey, list);
  }
  return map;
}

export function applyChangesToRow(
  original: Record<string, unknown> | null,
  changes: OdkChange[],
): MergedRecord | null {
  if (changes.length === 0) {
    if (!original) return null;
    return {
      data: { ...original },
      meta: {
        odkOverlay: true,
        hasLocalChanges: false,
        isCreatedLocally: false,
        isDeletedLocally: false,
      },
    };
  }

  let base: Record<string, unknown> | null = original ? { ...original } : null;
  let lastOp: OdkChangeOperation | undefined;
  let hasLocal = false;

  for (const ch of changes) {
    lastOp = ch.operation;
    hasLocal = true;
    if (ch.operation === 'CREATE') {
      base = { ...(ch.payload as Record<string, unknown>) };
    } else if (ch.operation === 'UPDATE' && base) {
      base = { ...base, ...(ch.payload as Record<string, unknown>) };
    } else if (ch.operation === 'DELETE') {
      return {
        data: original ? { ...original } : { ...ch.recordKeyJson },
        meta: {
          odkOverlay: true,
          hasLocalChanges: true,
          operation: 'DELETE',
          isCreatedLocally: false,
          isDeletedLocally: true,
          original: original ?? undefined,
        },
      };
    }
  }

  if (!base) return null;

  const isCreated = changes.some((c) => c.operation === 'CREATE');

  return {
    data: base,
    meta: {
      odkOverlay: true,
      hasLocalChanges: hasLocal,
      operation: lastOp,
      isCreatedLocally: isCreated && !original,
      isDeletedLocally: false,
      original: original && hasLocal ? { ...original } : undefined,
    },
  };
}

export function mergeListWithChanges(
  rows: Record<string, unknown>[],
  changes: OdkChange[],
  recordKeyColumn: string,
  options?: { includeDeleted?: boolean },
): MergedRecord[] {
  const byKey = latestChangesByKey(changes);
  const seen = new Set<string>();
  const result: MergedRecord[] = [];

  for (const row of rows) {
    const keyVal = row[recordKeyColumn];
    if (keyVal === undefined || keyVal === null) continue;
    const recordKey = `${recordKeyColumn}=${String(keyVal)}`;
    seen.add(recordKey);
    const merged = applyChangesToRow(row, byKey.get(recordKey) ?? []);
    if (!merged) continue;
    if (merged.meta.isDeletedLocally && !options?.includeDeleted) continue;
    result.push(merged);
  }

  for (const [recordKey, chList] of byKey) {
    if (seen.has(recordKey)) continue;
    const hasCreate = chList.some((c) => c.operation === 'CREATE');
    if (!hasCreate) continue;
    const merged = applyChangesToRow(null, chList);
    if (merged && !merged.meta.isDeletedLocally) result.push(merged);
  }

  return result;
}

export function stripGabiMeta(row: Record<string, unknown>): Record<string, unknown> {
  const { _gabi, ...rest } = row;
  void _gabi;
  return rest;
}

export function attachGabiMeta(merged: MergedRecord): Record<string, unknown> {
  return {
    ...merged.data,
    _gabi: merged.meta,
  };
}
