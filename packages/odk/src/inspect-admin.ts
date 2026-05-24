import { query } from '@gabi/db';
import type pg from 'pg';
import { detectOdkPlatform, type OdkPlatformDetection } from './detect-platform.js';
import {
  getTableColumns,
  pickReadableColumns,
  quoteColumn,
  quoteIdent,
  type TableRef,
} from './schema-probe.js';

export interface OdkDatabaseInfo {
  name: string;
  version: string;
  sizeBytes: number | null;
  connectedAs: string;
  accessibleSchemas: string[];
}

export interface OdkServerInfo {
  platform: OdkPlatformDetection['platform'];
  preferences: Array<{ key: string; value: string }>;
  config: Array<{ key: string; value: string }>;
}

export interface OdkUserRow {
  kind: 'site' | 'app' | 'anonymous' | 'unknown';
  id?: string | number;
  email?: string;
  displayName?: string;
  username?: string;
  active?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  extra?: Record<string, unknown>;
}

export interface OdkFormCatalogRow {
  id?: string | number;
  xmlFormId?: string;
  name?: string;
  version?: string;
  projectName?: string;
  tableName?: string;
  submissionCount?: number;
  createdAt?: string;
  extra?: Record<string, unknown>;
}

export interface OdkAdminOverview {
  scannedAt: string;
  readOnly: true;
  platform: OdkPlatformDetection;
  database: OdkDatabaseInfo;
  server: OdkServerInfo;
  users: OdkUserRow[];
  forms: OdkFormCatalogRow[];
  stats: {
    baseTableCount: number;
    submissionLikeTables: number;
  };
  warnings: string[];
}

async function loadDatabaseInfo(pool: pg.Pool): Promise<OdkDatabaseInfo> {
  const [ver, size, user, schemas] = await Promise.all([
    query<{ version: string }>(pool, `SELECT version() AS version`),
    query<{ size_bytes: string | null }>(
      pool,
      `SELECT pg_database_size(current_database())::text AS size_bytes`,
    ),
    query<{ user: string }>(pool, `SELECT current_user AS "user"`),
    query<{ schema_name: string }>(
      pool,
      `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name
      `,
    ),
  ]);

  return {
    name: (await query<{ db: string }>(pool, `SELECT current_database() AS db`))[0]?.db ?? '',
    version: ver[0]?.version ?? '',
    sizeBytes: size[0]?.size_bytes ? Number(size[0].size_bytes) : null,
    connectedAs: user[0]?.user ?? '',
    accessibleSchemas: schemas.map((s) => s.schema_name),
  };
}

async function loadStats(pool: pg.Pool): Promise<OdkAdminOverview['stats']> {
  const [tables, submissionCols] = await Promise.all([
    query<{ n: string }>(
      pool,
      `
      SELECT count(*)::text AS n
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND table_type = 'BASE TABLE'
      `,
    ),
    query<{ n: string }>(
      pool,
      `
      SELECT count(DISTINCT table_schema || '.' || table_name)::text AS n
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND column_name IN ('_uuid', '_submission_date', '_submission_time', 'meta', '__system')
      `,
    ),
  ]);
  return {
    baseTableCount: Number(tables[0]?.n ?? 0),
    submissionLikeTables: Number(submissionCols[0]?.n ?? 0),
  };
}

async function selectRows(
  pool: pg.Pool,
  ref: TableRef,
  preferredColumns: string[],
  limit = 200,
): Promise<Record<string, unknown>[]> {
  const columns = await getTableColumns(pool, ref);
  const picked = pickReadableColumns(columns, preferredColumns);
  if (picked.length === 0) return [];

  const selectList = picked.map(quoteColumn).join(', ');
  const sql = `SELECT ${selectList} FROM ${quoteIdent(ref.schema, ref.name)} LIMIT $1`;
  return query<Record<string, unknown>>(pool, sql, [limit]);
}

function rowToString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

async function loadCentralUsers(pool: pg.Pool, tables: Map<string, TableRef>): Promise<OdkUserRow[]> {
  const usersRef = tables.get('users');
  const actorsRef = tables.get('actors');
  if (!usersRef || !actorsRef) return [];

  const userCols = await getTableColumns(pool, usersRef);
  const actorCols = await getTableColumns(pool, actorsRef);
  const userEmail = userCols.find((c) => c.toLowerCase() === 'email') ?? 'email';
  const userActorId = userCols.find((c) => c.toLowerCase() === 'actorid') ?? 'actorId';
  const userLastLogin = userCols.find((c) => c.toLowerCase() === 'lastloginat');
  const userId = userCols.find((c) => c.toLowerCase() === 'id') ?? 'id';

  const actorDisplay = actorCols.find((c) => c.toLowerCase() === 'displayname') ?? 'displayName';
  const actorCreated = actorCols.find((c) => c.toLowerCase() === 'createdat');
  const actorDeleted = actorCols.find((c) => c.toLowerCase() === 'deletedat');
  const actorType = actorCols.find((c) => c.toLowerCase() === 'type') ?? 'type';
  const actorId = actorCols.find((c) => c.toLowerCase() === 'id') ?? 'id';

  const deletedFilter = actorDeleted
    ? `AND ${quoteColumn(actorDeleted)} IS NULL`
    : '';

  const sql = `
    SELECT
      u.${quoteColumn(userId)} AS user_id,
      u.${quoteColumn(userEmail)} AS email,
      ${userLastLogin ? `u.${quoteColumn(userLastLogin)} AS last_login` : 'NULL::timestamptz AS last_login'},
      a.${quoteColumn(actorId)} AS actor_id,
      a.${quoteColumn(actorDisplay)} AS display_name,
      a.${quoteColumn(actorType)} AS actor_type
      ${actorCreated ? `, a.${quoteColumn(actorCreated)} AS created_at` : ''}
    FROM ${quoteIdent(usersRef.schema, usersRef.name)} u
    JOIN ${quoteIdent(actorsRef.schema, actorsRef.name)} a
      ON u.${quoteColumn(userActorId)} = a.${quoteColumn(actorId)}
    WHERE a.${quoteColumn(actorType)} = 'user'
    ${deletedFilter}
    ORDER BY u.${quoteColumn(userEmail)}
    LIMIT 500
  `;

  const rows = await query<Record<string, unknown>>(pool, sql);
  return rows.map((r) => ({
    kind: 'site' as const,
    id: r.user_id as string | number,
    email: rowToString(r.email),
    displayName: rowToString(r.display_name),
    lastLoginAt: rowToString(r.last_login),
    createdAt: rowToString(r.created_at),
    extra: { actorId: r.actor_id, actorType: r.actor_type },
  }));
}

async function loadCentralAppUsers(pool: pg.Pool, tables: Map<string, TableRef>): Promise<OdkUserRow[]> {
  const fkRef = tables.get('field_keys');
  const actorsRef = tables.get('actors');
  const projectsRef = tables.get('projects');
  if (!fkRef || !actorsRef) return [];

  const fkCols = await getTableColumns(pool, fkRef);
  const actorCols = await getTableColumns(pool, actorsRef);
  const fkName = fkCols.find((c) => c.toLowerCase() === 'name') ?? 'name';
  const fkActor = fkCols.find((c) => c.toLowerCase() === 'actorid') ?? 'actorId';
  const fkProject = fkCols.find((c) => c.toLowerCase() === 'projectid');
  const actorDisplay = actorCols.find((c) => c.toLowerCase() === 'displayname') ?? 'displayName';
  const actorId = actorCols.find((c) => c.toLowerCase() === 'id') ?? 'id';

  let projectJoin = '';
  let projectSelect = '';
  if (fkProject && projectsRef) {
    const pCols = await getTableColumns(pool, projectsRef);
    const pName = pCols.find((c) => c.toLowerCase() === 'name') ?? 'name';
    const pId = pCols.find((c) => c.toLowerCase() === 'id') ?? 'id';
    projectJoin = `
      LEFT JOIN ${quoteIdent(projectsRef.schema, projectsRef.name)} p
        ON fk.${quoteColumn(fkProject)} = p.${quoteColumn(pId)}
    `;
    projectSelect = `, p.${quoteColumn(pName)} AS project_name`;
  }

  const sql = `
    SELECT
      fk.${quoteColumn(fkName)} AS app_user_name,
      a.${quoteColumn(actorDisplay)} AS display_name,
      a.${quoteColumn(actorId)} AS actor_id
      ${projectSelect}
    FROM ${quoteIdent(fkRef.schema, fkRef.name)} fk
    JOIN ${quoteIdent(actorsRef.schema, actorsRef.name)} a
      ON fk.${quoteColumn(fkActor)} = a.${quoteColumn(actorId)}
    ${projectJoin}
    ORDER BY fk.${quoteColumn(fkName)}
    LIMIT 500
  `;

  const rows = await query<Record<string, unknown>>(pool, sql);
  return rows.map((r) => ({
    kind: 'app' as const,
    displayName: rowToString(r.display_name) ?? rowToString(r.app_user_name),
    username: rowToString(r.app_user_name),
    extra: {
      actorId: r.actor_id,
      projectName: r.project_name,
    },
  }));
}

async function loadAggregateUsers(pool: pg.Pool, tables: Map<string, TableRef>): Promise<OdkUserRow[]> {
  const usersRef = tables.get('_registered_users');
  if (!usersRef) return [];

  const rows = await selectRows(pool, usersRef, [
    'URI',
    'uri',
    'USER_ID',
    'user_id',
    'EMAIL',
    'email',
    'NAME',
    'name',
    'DISPLAY_NAME',
    'display_name',
    'IS_ACTIVE',
    'is_active',
    'ACTIVE',
    'active',
    'CREATED_DATE',
    'created_date',
  ]);

  return rows.map((r) => {
    const openIdEmail = rowToString(r.OPENID_EMAIL ?? r.openid_email);
    const email =
      rowToString(r.EMAIL ?? r.email) ??
      (openIdEmail?.startsWith('mailto:') ? openIdEmail.slice(7) : openIdEmail);
    const name = rowToString(
      r.FULL_NAME ?? r.full_name ?? r.NAME ?? r.name ?? r.DISPLAY_NAME ?? r.display_name,
    );
    const uri = rowToString(r._URI ?? r.URI ?? r.uri ?? r.USER_ID ?? r.user_id);
    const localUser = rowToString(r.LOCAL_USERNAME ?? r.local_username);
    const removed = r.IS_REMOVED ?? r.is_removed;
    const activeRaw = r.IS_ACTIVE ?? r.is_active ?? r.ACTIVE ?? r.active;
    let active: boolean | undefined;
    if (removed != null) active = !Boolean(removed);
    else if (activeRaw != null) active = Boolean(activeRaw);

    return {
      kind: 'site' as const,
      id: uri,
      email,
      displayName: name ?? localUser ?? email,
      username: localUser ?? uri,
      active,
      createdAt: rowToString(r._CREATION_DATE ?? r.CREATED_DATE ?? r.created_date),
      extra: Object.fromEntries(
        Object.entries(r).filter(([k]) => !/password|secret|token/i.test(k)),
      ),
    };
  });
}

async function loadCentralForms(pool: pg.Pool, tables: Map<string, TableRef>): Promise<OdkFormCatalogRow[]> {
  const formsRef = tables.get('forms');
  if (!formsRef) return [];

  const formCols = await getTableColumns(pool, formsRef);
  const xmlId = formCols.find((c) => c.toLowerCase() === 'xmlformid') ?? 'xmlFormId';
  const version = formCols.find((c) => c.toLowerCase() === 'version');
  const formId = formCols.find((c) => c.toLowerCase() === 'id') ?? 'id';
  const projectId = formCols.find((c) => c.toLowerCase() === 'projectid');
  const createdAt = formCols.find((c) => c.toLowerCase() === 'createdat');
  const projectsRef = tables.get('projects');

  let projectJoin = '';
  let projectSelect = '';
  if (projectId && projectsRef) {
    const pCols = await getTableColumns(pool, projectsRef);
    const pName = pCols.find((c) => c.toLowerCase() === 'name') ?? 'name';
    const pId = pCols.find((c) => c.toLowerCase() === 'id') ?? 'id';
    projectJoin = `
      LEFT JOIN ${quoteIdent(projectsRef.schema, projectsRef.name)} p
        ON f.${quoteColumn(projectId)} = p.${quoteColumn(pId)}
    `;
    projectSelect = `, p.${quoteColumn(pName)} AS project_name`;
  }

  const sql = `
    SELECT
      f.${quoteColumn(formId)} AS form_id,
      f.${quoteColumn(xmlId)} AS xml_form_id
      ${version ? `, f.${quoteColumn(version)} AS version` : ''}
      ${createdAt ? `, f.${quoteColumn(createdAt)} AS created_at` : ''}
      ${projectSelect}
    FROM ${quoteIdent(formsRef.schema, formsRef.name)} f
    ${projectJoin}
    ORDER BY f.${quoteColumn(xmlId)}
    LIMIT 300
  `;

  const rows = await query<Record<string, unknown>>(pool, sql);
  return rows.map((r) => ({
    id: r.form_id as string | number,
    xmlFormId: rowToString(r.xml_form_id),
    version: rowToString(r.version),
    projectName: rowToString(r.project_name),
    createdAt: rowToString(r.created_at),
  }));
}

async function loadAggregateForms(pool: pg.Pool, tables: Map<string, TableRef>): Promise<OdkFormCatalogRow[]> {
  const formInfoRef = tables.get('_form_info');
  if (!formInfoRef) return [];

  const rows = await selectRows(pool, formInfoRef, [
    '_URI',
    'URI',
    'uri',
    'FORM_ID',
    'form_id',
    'FORM_NAME',
    'form_name',
    'FORM_VERSION',
    'form_version',
    'CREATION_DATE',
    'creation_date',
    '_CREATION_DATE',
  ]);

  return rows.map((r) => ({
    id: rowToString(r._URI ?? r.URI ?? r.uri),
    xmlFormId: rowToString(r.FORM_ID ?? r.form_id),
    name: rowToString(r.FORM_NAME ?? r.form_name),
    version: rowToString(r.FORM_VERSION ?? r.form_version),
    createdAt: rowToString(r._CREATION_DATE ?? r.CREATION_DATE ?? r.creation_date),
    extra: Object.fromEntries(Object.entries(r).slice(0, 8)),
  }));
}

async function loadServerPreferences(
  pool: pg.Pool,
  platform: OdkPlatformDetection,
  tables: Map<string, TableRef>,
): Promise<OdkServerInfo> {
  const preferences: OdkServerInfo['preferences'] = [];
  const config: OdkServerInfo['config'] = [];

  if (platform.platform === 'aggregate') {
    const prefRef = tables.get('_server_preferences');
    if (prefRef) {
      const rows = await selectRows(pool, prefRef, [
        'KEY',
        'key',
        'VALUE',
        'value',
        'PREF_KEY',
        'pref_key',
        'PREF_VALUE',
        'pref_value',
      ], 100);
      for (const r of rows) {
        const key = rowToString(r.KEY ?? r.key ?? r.PREF_KEY ?? r.pref_key);
        const value = rowToString(r.VALUE ?? r.value ?? r.PREF_VALUE ?? r.pref_value);
        if (key) preferences.push({ key, value: value ?? '' });
      }
    }
  }

  if (platform.platform === 'central') {
    const configRef = tables.get('config') ?? tables.get('configs');
    if (configRef) {
      const rows = await selectRows(pool, configRef, ['key', 'value'], 80);
      for (const r of rows) {
        const key = rowToString(r.key);
        const value = rowToString(r.value);
        if (key) config.push({ key, value: value ?? '' });
      }
    }
  }

  return { platform: platform.platform, preferences, config };
}

/**
 * Visão administrativa somente leitura do Postgres ODK (Central ou Aggregate).
 */
export async function inspectOdkAdmin(pool: pg.Pool): Promise<OdkAdminOverview> {
  const warnings: string[] = [];
  const platform = await detectOdkPlatform(pool);
  const tableMap = new Map<string, TableRef>();
  for (const [k, v] of Object.entries(platform.tables)) {
    if (v) tableMap.set(k, v);
  }

  if (platform.platform === 'unknown') {
    warnings.push(
      'Não foi possível classificar como ODK Central ou Aggregate. Exibindo dados genéricos disponíveis.',
    );
  }

  const [database, stats, server] = await Promise.all([
    loadDatabaseInfo(pool),
    loadStats(pool),
    loadServerPreferences(pool, platform, tableMap),
  ]);

  let users: OdkUserRow[] = [];
  let forms: OdkFormCatalogRow[] = [];

  try {
    if (platform.platform === 'central' || platform.platform === 'unknown') {
      const siteUsers = await loadCentralUsers(pool, tableMap);
      const appUsers = await loadCentralAppUsers(pool, tableMap);
      if (siteUsers.length || appUsers.length) {
        users = [...siteUsers, ...appUsers];
        if (platform.platform === 'unknown' && users.length) {
          platform.platform = 'central';
          platform.confidence = 'medium';
          platform.signals.push('inferred:central_users');
        }
      }
      const centralForms = await loadCentralForms(pool, tableMap);
      if (centralForms.length) forms = centralForms;
    }
  } catch (e) {
    warnings.push(`Central: falha ao ler usuários/formulários — ${String(e)}`);
  }

  try {
    if (platform.platform === 'aggregate' || (platform.platform === 'unknown' && users.length === 0)) {
      const aggUsers = await loadAggregateUsers(pool, tableMap);
      const aggForms = await loadAggregateForms(pool, tableMap);
      if (aggUsers.length) {
        users = aggUsers;
        if (platform.platform === 'unknown') {
          platform.platform = 'aggregate';
          platform.confidence = 'medium';
          platform.signals.push('inferred:aggregate_users');
        }
      }
      if (aggForms.length) forms = aggForms;
    }
  } catch (e) {
    warnings.push(`Aggregate: falha ao ler usuários/formulários — ${String(e)}`);
  }

  if (users.length === 0) {
    warnings.push(
      'Nenhum usuário listado. Verifique permissões SELECT nas tabelas users/_registered_users (usuário somente leitura do GABI).',
    );
  }

  return {
    scannedAt: new Date().toISOString(),
    readOnly: true,
    platform,
    database,
    server,
    users,
    forms,
    stats,
    warnings,
  };
}
