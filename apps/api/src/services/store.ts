import type { DataSource, Page, PermissionAction } from '@gabi/core';
import { query, getDefaultPool } from '@gabi/db';

export async function loadDataSources(): Promise<Map<string, DataSource>> {
  const pool = getDefaultPool();
  const rows = await query<{
    id: string;
    connection_id: string;
    schema_name: string;
    table_name: string;
    label: string;
    geometry_column: string | null;
    latitude_column: string | null;
    longitude_column: string | null;
    columns_meta: unknown;
    primary_key: unknown;
    odk_read_only: boolean;
    record_key_column: string | null;
    enabled: boolean;
    created_at: Date;
  }>(pool, `SELECT * FROM gabi_data_source WHERE enabled = true`);

  const map = new Map<string, DataSource>();
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      connectionId: r.connection_id,
      schema: r.schema_name,
      table: r.table_name,
      label: r.label,
      geometryColumn: r.geometry_column ?? undefined,
      latitudeColumn: r.latitude_column ?? undefined,
      longitudeColumn: r.longitude_column ?? undefined,
      columns: r.columns_meta as DataSource['columns'],
      primaryKey: r.primary_key as string[],
      odkReadOnly: r.odk_read_only,
      recordKeyColumn: r.record_key_column ?? undefined,
      enabled: r.enabled,
      createdAt: r.created_at.toISOString(),
    });
  }
  return map;
}

export async function saveDataSource(ds: DataSource): Promise<void> {
  const pool = getDefaultPool();
  await query(
    pool,
    `
    INSERT INTO gabi_data_source (
      id, connection_id, schema_name, table_name, label, geometry_column,
      latitude_column, longitude_column, columns_meta, primary_key,
      odk_read_only, record_key_column, enabled
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (id) DO UPDATE SET
      connection_id = EXCLUDED.connection_id,
      label = EXCLUDED.label,
      geometry_column = EXCLUDED.geometry_column,
      latitude_column = EXCLUDED.latitude_column,
      longitude_column = EXCLUDED.longitude_column,
      columns_meta = EXCLUDED.columns_meta,
      primary_key = EXCLUDED.primary_key,
      odk_read_only = EXCLUDED.odk_read_only,
      record_key_column = EXCLUDED.record_key_column,
      enabled = EXCLUDED.enabled
    `,
    [
      ds.id,
      ds.connectionId,
      ds.schema,
      ds.table,
      ds.label,
      ds.geometryColumn ?? null,
      ds.latitudeColumn ?? null,
      ds.longitudeColumn ?? null,
      JSON.stringify(ds.columns),
      JSON.stringify(ds.primaryKey),
      ds.odkReadOnly ?? false,
      ds.recordKeyColumn ?? null,
      ds.enabled,
    ],
  );
}

export async function savePage(page: Page): Promise<void> {
  const pool = getDefaultPool();
  await query(
    pool,
    `
    INSERT INTO gabi_page (id, type, connection_id, data_source_id, resource, label, config)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      config = EXCLUDED.config
    `,
    [
      page.id,
      page.type,
      page.connectionId,
      page.dataSourceId,
      page.resource,
      page.label,
      JSON.stringify(page.config),
    ],
  );
}

export async function loadPages(connectionId?: string): Promise<Page[]> {
  const pool = getDefaultPool();
  const rows = await query<{
    id: string;
    type: string;
    connection_id: string;
    data_source_id: string;
    resource: string;
    label: string;
    config: unknown;
    created_at: Date;
  }>(
    pool,
    connectionId
      ? `SELECT * FROM gabi_page WHERE connection_id = $1 ORDER BY created_at`
      : `SELECT * FROM gabi_page ORDER BY created_at`,
    connectionId ? [connectionId] : [],
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type as Page['type'],
    connectionId: r.connection_id,
    dataSourceId: r.data_source_id,
    resource: r.resource,
    label: r.label,
    config: r.config as Record<string, unknown>,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function addPermissionsForResource(
  resource: string,
  actions: PermissionAction[],
): Promise<void> {
  const pool = getDefaultPool();
  const { randomUUID } = await import('node:crypto');

  for (const action of actions) {
    const permId = randomUUID();
    await query(
      pool,
      `INSERT INTO gabi_permission (id, resource, action) VALUES ($1, $2, $3)
       ON CONFLICT (resource, action) DO NOTHING`,
      [permId, resource, action],
    );

    const perm = await query<{ id: string }>(
      pool,
      `SELECT id FROM gabi_permission WHERE resource = $1 AND action = $2`,
      [resource, action],
    );

    const adminRole = await query<{ id: string }>(
      pool,
      `SELECT id FROM gabi_role WHERE name = 'admin'`,
    );
    if (adminRole[0] && perm[0]) {
      await query(
        pool,
        `INSERT INTO gabi_role_permission (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [adminRole[0].id, perm[0].id],
      );
    }
  }
}
