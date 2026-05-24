import type { DataSource, Page, PageListItem, PageScope, PermissionAction, TableMeta } from '@gabi/core';
import { NotFoundError } from '@gabi/core';
import { detectGeoColumns, inferGeoSource } from '@gabi/introspector';
import { query, getDefaultPool } from '@gabi/db';
import { canUserAccessPage } from './page-access.js';
import type { AppAbility } from './auth.js';

function enrichDataSourceGeo(ds: DataSource): DataSource {
  const table: TableMeta = {
    schema: ds.schema,
    name: ds.table,
    type: 'table',
    columns: ds.columns,
    primaryKey: ds.primaryKey,
    geometryColumn: ds.geometryColumn,
    latitudeColumn: ds.latitudeColumn,
    longitudeColumn: ds.longitudeColumn,
  };
  const detected = detectGeoColumns(table);
  const geometryColumn = ds.geometryColumn ?? detected.geometryColumn;
  const latitudeColumn = ds.latitudeColumn ?? detected.latitudeColumn;
  const longitudeColumn = ds.longitudeColumn ?? detected.longitudeColumn;
  return {
    ...ds,
    geometryColumn,
    latitudeColumn,
    longitudeColumn,
    geoSource:
      ds.geoSource ??
      detected.geoSource ??
      inferGeoSource({ geometryColumn, latitudeColumn, longitudeColumn }),
  };
}

type PageRow = {
  id: string;
  type: string;
  connection_id: string;
  data_source_id: string;
  module_id: string | null;
  resource: string;
  label: string;
  scope: string;
  owner_user_id: string | null;
  config: unknown;
  created_at: Date;
};

function mapPageRow(r: PageRow): Page {
  return {
    id: r.id,
    type: r.type as Page['type'],
    connectionId: r.connection_id,
    dataSourceId: r.data_source_id,
    moduleId: r.module_id ?? undefined,
    resource: r.resource,
    label: r.label,
    scope: (r.scope === 'private' ? 'private' : 'global') as PageScope,
    ownerUserId: r.owner_user_id ?? undefined,
    config: r.config as Record<string, unknown>,
    createdAt: r.created_at.toISOString(),
  };
}

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
    geo_source: string | null;
    columns_meta: unknown;
    primary_key: unknown;
    odk_read_only: boolean;
    record_key_column: string | null;
    enabled: boolean;
    created_at: Date;
  }>(pool, `SELECT * FROM gabi_data_source WHERE enabled = true`);

  const map = new Map<string, DataSource>();
  for (const r of rows) {
    map.set(
      r.id,
      enrichDataSourceGeo({
        id: r.id,
        connectionId: r.connection_id,
        schema: r.schema_name,
        table: r.table_name,
        label: r.label,
        geometryColumn: r.geometry_column ?? undefined,
        latitudeColumn: r.latitude_column ?? undefined,
        longitudeColumn: r.longitude_column ?? undefined,
        geoSource: (r.geo_source as DataSource['geoSource']) ?? undefined,
        columns: r.columns_meta as DataSource['columns'],
        primaryKey: r.primary_key as string[],
        odkReadOnly: r.odk_read_only,
        recordKeyColumn: r.record_key_column ?? undefined,
        enabled: r.enabled,
        createdAt: r.created_at.toISOString(),
      }),
    );
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
      latitude_column, longitude_column, geo_source, columns_meta, primary_key,
      odk_read_only, record_key_column, enabled
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (id) DO UPDATE SET
      connection_id = EXCLUDED.connection_id,
      label = EXCLUDED.label,
      geometry_column = EXCLUDED.geometry_column,
      latitude_column = EXCLUDED.latitude_column,
      longitude_column = EXCLUDED.longitude_column,
      geo_source = EXCLUDED.geo_source,
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
      ds.geoSource ?? null,
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
    INSERT INTO gabi_page (
      id, type, connection_id, data_source_id, module_id, resource, label, scope, owner_user_id, config
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      module_id = EXCLUDED.module_id,
      scope = EXCLUDED.scope,
      owner_user_id = EXCLUDED.owner_user_id,
      config = EXCLUDED.config
    `,
    [
      page.id,
      page.type,
      page.connectionId,
      page.dataSourceId,
      page.moduleId ?? null,
      page.resource,
      page.label,
      page.scope,
      page.ownerUserId ?? null,
      JSON.stringify(page.config),
    ],
  );
}

export async function loadPages(
  options: {
    connectionId?: string;
    moduleId?: string;
    userId?: string;
    ability?: AppAbility;
  } = {},
): Promise<PageListItem[]> {
  const pool = getDefaultPool();
  const { connectionId, moduleId, userId, ability } = options;
  const seeAll = ability?.can('manage', 'all');

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (connectionId) {
    params.push(connectionId);
    conditions.push(`p.connection_id = $${params.length}`);
  }

  if (moduleId) {
    params.push(moduleId);
    conditions.push(`p.module_id = $${params.length}`);
  }

  if (!seeAll) {
    params.push(userId);
    conditions.push(`(p.scope = 'global' OR p.owner_user_id = $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<
    PageRow & {
      schema_name: string;
      table_name: string;
      geometry_column: string | null;
      connection_name: string;
      module_name: string | null;
    }
  >(
    pool,
    `
    SELECT
      p.id, p.type, p.connection_id, p.data_source_id, p.module_id, p.resource, p.label,
      p.scope, p.owner_user_id, p.config, p.created_at,
      ds.schema_name, ds.table_name, ds.geometry_column,
      c.name AS connection_name,
      m.name AS module_name
    FROM gabi_page p
    INNER JOIN gabi_data_source ds ON ds.id = p.data_source_id
    INNER JOIN gabi_connection c ON c.id = p.connection_id
    LEFT JOIN gabi_module m ON m.id = p.module_id
    ${where}
    ORDER BY m.sort_order NULLS LAST, m.name, p.label
    `,
    params,
  );

  return rows
    .map((r) => ({
      ...mapPageRow(r),
      schema: r.schema_name,
      table: r.table_name,
      connectionName: r.connection_name,
      moduleName: r.module_name ?? undefined,
      geometryColumn: r.geometry_column ?? undefined,
    }))
    .filter((p) => seeAll || canUserAccessPage(userId, p, ability));
}

export async function getPageById(id: string): Promise<Page> {
  const pool = getDefaultPool();
  const rows = await query<PageRow>(pool, `SELECT * FROM gabi_page WHERE id = $1`, [id]);
  const r = rows[0];
  if (!r) throw new NotFoundError(`Página não encontrada: ${id}`);
  return mapPageRow(r);
}

export async function getPageByResource(resource: string): Promise<Page | null> {
  const pool = getDefaultPool();
  const rows = await query<PageRow>(pool, `SELECT * FROM gabi_page WHERE resource = $1`, [resource]);
  const r = rows[0];
  return r ? mapPageRow(r) : null;
}

export async function getPagesByDataSourceId(dataSourceId: string): Promise<Page[]> {
  const pool = getDefaultPool();
  const rows = await query<PageRow>(pool, `SELECT * FROM gabi_page WHERE data_source_id = $1`, [
    dataSourceId,
  ]);
  return rows.map(mapPageRow);
}

export async function assertPageAccess(
  userId: string | undefined,
  ability: AppAbility | undefined,
  opts: { resource?: string; dataSourceId?: string },
): Promise<void> {
  const { ForbiddenError } = await import('@gabi/core');
  let pages: Page[] = [];
  if (opts.resource) {
    const p = await getPageByResource(opts.resource);
    if (p) pages = [p];
  } else if (opts.dataSourceId) {
    pages = await getPagesByDataSourceId(opts.dataSourceId);
  }
  if (pages.length === 0) return;
  const allowed = pages.some((p) => canUserAccessPage(userId, p, ability));
  if (!allowed) throw new ForbiddenError('Sem acesso a esta página');
}

export async function updatePage(
  id: string,
  patch: {
    label?: string;
    config?: Record<string, unknown>;
    scope?: PageScope;
    ownerUserId?: string | null;
    moduleId?: string | null;
  },
): Promise<Page> {
  const pool = getDefaultPool();
  const current = await getPageById(id);
  const label = patch.label ?? current.label;
  const config = patch.config ?? current.config;
  const scope = patch.scope ?? current.scope;
  const moduleId =
    patch.moduleId !== undefined ? patch.moduleId : (current.moduleId ?? null);
  const ownerUserId =
    patch.ownerUserId !== undefined
      ? patch.ownerUserId
      : scope === 'private'
        ? (current.ownerUserId ?? null)
        : null;

  await query(
    pool,
    `UPDATE gabi_page SET label = $2, config = $3, scope = $4, owner_user_id = $5, module_id = $6 WHERE id = $1`,
    [id, label, JSON.stringify(config), scope, ownerUserId, moduleId],
  );
  return getPageById(id);
}

export async function deletePage(id: string): Promise<void> {
  const pool = getDefaultPool();
  const page = await getPageById(id);

  await query(pool, `DELETE FROM gabi_page WHERE id = $1`, [id]);

  const others = await query<{ id: string }>(
    pool,
    `SELECT id FROM gabi_page WHERE data_source_id = $1 LIMIT 1`,
    [page.dataSourceId],
  );
  if (!others[0]) {
    await query(pool, `DELETE FROM gabi_data_source WHERE id = $1`, [page.dataSourceId]);
  }

  const perms = await query<{ id: string }>(
    pool,
    `SELECT id FROM gabi_permission WHERE resource = $1`,
    [page.resource],
  );
  for (const p of perms) {
    await query(pool, `DELETE FROM gabi_role_permission WHERE permission_id = $1`, [p.id]);
    await query(pool, `DELETE FROM gabi_permission WHERE id = $1`, [p.id]);
  }
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
