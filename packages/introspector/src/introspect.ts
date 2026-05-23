import type {
  ColumnMeta,
  ForeignKeyMeta,
  IntrospectionResult,
  TableMeta,
} from '@gabi/core';
import { query } from '@gabi/db';
import type pg from 'pg';
import { columnLooksLikeGeometry, enrichTableWithGeo } from './geometry.js';

interface ColumnRow {
  table_schema: string;
  table_name: string;
  table_type: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  ordinal_position: number;
}

interface PkRow {
  table_schema: string;
  table_name: string;
  column_name: string;
}

interface FkRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface GeoRow {
  f_table_schema: string;
  f_table_name: string;
  f_geometry_column: string;
}

const EXCLUDED_SCHEMAS = [
  'pg_catalog',
  'information_schema',
  'pg_toast',
];

export async function introspectDatabase(pool: pg.Pool): Promise<IntrospectionResult> {
  const columns = await query<ColumnRow>(
    pool,
    `
    SELECT
      c.table_schema,
      c.table_name,
      t.table_type,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
      AND t.table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `,
    EXCLUDED_SCHEMAS,
  );

  const primaryKeys = await query<PkRow>(
    pool,
    `
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
    ORDER BY kcu.ordinal_position
    `,
    EXCLUDED_SCHEMAS,
  );

  const foreignKeys = await query<FkRow>(
    pool,
    `
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
    `,
    EXCLUDED_SCHEMAS,
  );

  let geometryColumns: GeoRow[] = [];
  try {
    geometryColumns = await query<GeoRow>(
      pool,
      `
      SELECT f_table_schema, f_table_name, f_geometry_column
      FROM geometry_columns
      WHERE f_table_schema NOT IN (${EXCLUDED_SCHEMAS.map((_, i) => `$${i + 1}`).join(', ')})
      `,
      EXCLUDED_SCHEMAS,
    );
  } catch {
    // PostGIS not installed — fallback to udt heuristics
  }

  const geoSet = new Set(
    geometryColumns.map((g) => `${g.f_table_schema}.${g.f_table_name}.${g.f_geometry_column}`),
  );

  const pkMap = new Map<string, string[]>();
  for (const pk of primaryKeys) {
    const key = `${pk.table_schema}.${pk.table_name}`;
    const list = pkMap.get(key) ?? [];
    list.push(pk.column_name);
    pkMap.set(key, list);
  }

  const fkMap = new Map<string, { table: string; column: string }>();
  for (const fk of foreignKeys) {
    fkMap.set(`${fk.table_schema}.${fk.table_name}.${fk.column_name}`, {
      table: `${fk.foreign_table_schema}.${fk.foreign_table_name}`,
      column: fk.foreign_column_name,
    });
  }

  const tableMap = new Map<string, TableMeta>();

  for (const row of columns) {
    const key = `${row.table_schema}.${row.table_name}`;
    let table = tableMap.get(key);
    if (!table) {
      table = {
        schema: row.table_schema,
        name: row.table_name,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        columns: [],
        primaryKey: pkMap.get(key) ?? [],
      };
      tableMap.set(key, table);
    }

    const colKey = `${row.table_schema}.${row.table_name}.${row.column_name}`;
    const fk = fkMap.get(colKey);
    const isGeometry =
      geoSet.has(colKey) || columnLooksLikeGeometry(row.udt_name, row.data_type);

    const col: ColumnMeta = {
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === 'YES',
      isPrimaryKey: (pkMap.get(key) ?? []).includes(row.column_name),
      isForeignKey: Boolean(fk),
      referencedTable: fk?.table,
      referencedColumn: fk?.column,
      isGeometry,
      isLatitude: false,
      isLongitude: false,
    };

    table.columns.push(col);
  }

  const tables = [...tableMap.values()].map(enrichTableWithGeo);

  const fkMeta: ForeignKeyMeta[] = foreignKeys.map((fk) => ({
    schema: fk.table_schema,
    table: fk.table_name,
    column: fk.column_name,
    referencedSchema: fk.foreign_table_schema,
    referencedTable: fk.foreign_table_name,
    referencedColumn: fk.foreign_column_name,
  }));

  return {
    tables,
    foreignKeys: fkMeta,
    scannedAt: new Date().toISOString(),
  };
}

export function toDataSourceId(connectionId: string, schema: string, table: string): string {
  return `${connectionId}::${schema}.${table}`.replace(/[^a-zA-Z0-9._:-]/g, '_');
}
