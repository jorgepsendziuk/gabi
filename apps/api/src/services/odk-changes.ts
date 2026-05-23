import { randomUUID } from 'node:crypto';
import type { DataSource, OdkChange, OdkChangeOperation } from '@gabi/core';
import { query, getDefaultPool } from '@gabi/db';
import {
  buildRecordKeyJson,
  recordKeyToString,
  parseRecordKeyString,
} from '@gabi/odk';

interface ChangeRow {
  id: string;
  connection_id: string;
  schema_name: string;
  table_name: string;
  record_key: string;
  record_key_json: unknown;
  operation: string;
  payload: unknown;
  user_id: string | null;
  created_at: Date;
}

function mapRow(r: ChangeRow): OdkChange {
  return {
    id: r.id,
    connectionId: r.connection_id,
    schema: r.schema_name,
    table: r.table_name,
    recordKey: r.record_key,
    recordKeyJson: r.record_key_json as Record<string, unknown>,
    operation: r.operation as OdkChangeOperation,
    payload: r.payload as Record<string, unknown>,
    userId: r.user_id ?? undefined,
    createdAt: r.created_at.toISOString(),
  };
}

export async function loadChangesForDataSource(ds: DataSource): Promise<OdkChange[]> {
  const pool = getDefaultPool();
  const rows = await query<ChangeRow>(
    pool,
    `
    SELECT * FROM gabi_odk_change
    WHERE connection_id = $1 AND schema_name = $2 AND table_name = $3
    ORDER BY created_at ASC
    `,
    [ds.connectionId, ds.schema, ds.table],
  );
  return rows.map(mapRow);
}

export async function appendOdkChange(input: {
  ds: DataSource;
  operation: OdkChangeOperation;
  recordKeyJson?: Record<string, unknown>;
  payload: Record<string, unknown>;
  userId?: string;
}): Promise<OdkChange> {
  const pool = getDefaultPool();
  const id = randomUUID();

  let recordKeyJson = input.recordKeyJson;
  if (!recordKeyJson && input.operation === 'CREATE') {
    const keyCol = input.ds.recordKeyColumn ?? '_uuid';
    const keyVal = input.payload[keyCol] ?? randomUUID();
    recordKeyJson = { [keyCol]: keyVal };
    if (!input.payload[keyCol]) {
      input.payload[keyCol] = keyVal;
    }
  }
  if (!recordKeyJson) {
    throw new Error('recordKeyJson obrigatório para UPDATE/DELETE');
  }

  const recordKey = recordKeyToString(recordKeyJson);

  await query(
    pool,
    `
    INSERT INTO gabi_odk_change (
      id, connection_id, schema_name, table_name,
      record_key, record_key_json, operation, payload, user_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      id,
      input.ds.connectionId,
      input.ds.schema,
      input.ds.table,
      recordKey,
      JSON.stringify(recordKeyJson),
      input.operation,
      JSON.stringify(input.payload),
      input.userId ?? null,
    ],
  );

  const rows = await query<ChangeRow>(pool, `SELECT * FROM gabi_odk_change WHERE id = $1`, [id]);
  return mapRow(rows[0]!);
}

export function resolveRecordKeyFromId(
  ds: DataSource,
  recordId: string,
): Record<string, unknown> {
  if (recordId.includes('=')) {
    return parseRecordKeyString(decodeURIComponent(recordId));
  }
  const keyCol = ds.recordKeyColumn ?? ds.primaryKey[0] ?? '_uuid';
  return { [keyCol]: recordId };
}

export function recordKeyJsonFromRow(
  ds: DataSource,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const keyCol = ds.recordKeyColumn ?? ds.primaryKey[0] ?? '_uuid';
  return buildRecordKeyJson(row, keyCol);
}
