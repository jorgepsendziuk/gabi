import { query } from '@gabi/db';
import type pg from 'pg';

export interface TableRef {
  schema: string;
  name: string;
}

const EXCLUDED_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

/** Localiza tabelas pelo nome (case-insensitive) em schemas acessíveis. */
export async function findTablesByName(
  pool: pg.Pool,
  tableNames: string[],
): Promise<Map<string, TableRef>> {
  const lowered = tableNames.map((n) => n.toLowerCase());
  const rows = await query<{ table_schema: string; table_name: string }>(
    pool,
    `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
      AND lower(table_name) = ANY($${EXCLUDED_SCHEMAS.length + 1}::text[])
    `,
    [...EXCLUDED_SCHEMAS, lowered],
  );

  const found = new Map<string, TableRef>();
  for (const row of rows) {
    const key = row.table_name.toLowerCase();
    if (!found.has(key)) {
      found.set(key, { schema: row.table_schema, name: row.table_name });
    }
  }
  return found;
}

export async function listAccessibleSchemas(pool: pg.Pool): Promise<string[]> {
  const rows = await query<{ schema_name: string }>(
    pool,
    `
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
      AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name
    `,
    EXCLUDED_SCHEMAS,
  );
  return rows.map((r) => r.schema_name);
}

export async function getTableColumns(
  pool: pg.Pool,
  ref: TableRef,
): Promise<string[]> {
  const rows = await query<{ column_name: string }>(
    pool,
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
    `,
    [ref.schema, ref.name],
  );
  return rows.map((r) => r.column_name);
}

const SENSITIVE_COLUMN = /password|secret|token|credential|hash|salt|private/i;

export function pickReadableColumns(columns: string[], preferred: string[]): string[] {
  const safe = columns.filter((c) => !SENSITIVE_COLUMN.test(c));
  const picked: string[] = [];
  for (const p of preferred) {
    const match = safe.find((c) => c.toLowerCase() === p.toLowerCase());
    if (match && !picked.includes(match)) picked.push(match);
  }
  for (const c of safe) {
    if (!picked.includes(c) && picked.length < 12) picked.push(c);
  }
  return picked.slice(0, 12);
}

export function quoteIdent(schema: string, table: string): string {
  return `"${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"`;
}

export function quoteColumn(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
