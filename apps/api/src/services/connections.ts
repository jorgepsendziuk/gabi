import { randomUUID, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import type { DbConnection } from '@gabi/core';
import type { DbConfig } from '@gabi/db';
import { NotFoundError, GabiError } from '@gabi/core';
import { closePool, getDefaultPool, getPool, query } from '@gabi/db';
import type pg from 'pg';

const ALGO = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret = process.env.CONNECTION_SECRET ?? process.env.JWT_SECRET ?? 'gabi-dev-secret';
  return scryptSync(secret, 'gabi-salt', 32);
}

export function encryptPassword(plain: string): string {
  const iv = Buffer.alloc(16, 0);
  const cipher = createCipheriv(ALGO, getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptPassword(enc: string): string {
  const parts = enc.split(':');
  if (parts[0] !== 'v1' || parts.length !== 3) {
    throw new GabiError('Senha de conexão inválida', 'INVALID_CONNECTION_SECRET');
  }
  const tag = Buffer.from(parts[1]!, 'hex');
  const data = Buffer.from(parts[2]!, 'hex');
  const iv = Buffer.alloc(16, 0);
  const decipher = createDecipheriv(ALGO, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function connectionToDbConfig(row: {
  host: string;
  port: number;
  database_name: string;
  db_user: string;
  password_enc: string;
  ssl: boolean;
}): DbConfig {
  return {
    host: row.host,
    port: row.port,
    database: row.database_name,
    user: row.db_user,
    password: decryptPassword(row.password_enc),
    ssl: row.ssl,
  };
}

interface ConnectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  host: string;
  port: number;
  database_name: string;
  db_user: string;
  password_enc: string;
  ssl: boolean;
  is_default: boolean;
  is_odk_source: boolean;
  enabled: boolean;
  last_introspected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapConnection(r: ConnectionRow): DbConnection {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? undefined,
    host: r.host,
    port: r.port,
    database: r.database_name,
    user: r.db_user,
    ssl: r.ssl,
    isDefault: r.is_default,
    isOdkSource: r.is_odk_source,
    enabled: r.enabled,
    lastIntrospectedAt: r.last_introspected_at?.toISOString(),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listConnections(): Promise<DbConnection[]> {
  const pool = getDefaultPool();
  const rows = await query<ConnectionRow>(
    pool,
    `SELECT id, name, slug, description, host, port, database_name, db_user,
            password_enc, ssl, is_default, is_odk_source, enabled, last_introspected_at, created_at, updated_at
     FROM gabi_connection
     WHERE enabled = true
     ORDER BY is_default DESC, name`,
  );
  return rows.map(mapConnection);
}

export async function getConnectionById(id: string): Promise<ConnectionRow> {
  const pool = getDefaultPool();
  const rows = await query<ConnectionRow>(
    pool,
    `SELECT * FROM gabi_connection WHERE id = $1 AND enabled = true`,
    [id],
  );
  if (!rows[0]) throw new NotFoundError(`Conexão não encontrada: ${id}`);
  return rows[0];
}

export async function getConnectionPool(connectionId: string): Promise<pg.Pool> {
  const row = await getConnectionById(connectionId);
  const config = connectionToDbConfig(row);
  return getPool(`conn:${connectionId}`, config);
}

export async function getDefaultConnectionId(): Promise<string> {
  const pool = getDefaultPool();
  const rows = await query<{ id: string }>(
    pool,
    `SELECT id FROM gabi_connection WHERE is_default = true LIMIT 1`,
  );
  if (rows[0]) return rows[0].id;
  const any = await query<{ id: string }>(pool, `SELECT id FROM gabi_connection LIMIT 1`);
  if (!any[0]) {
    throw new NotFoundError(
      'Nenhuma conexão de dados cadastrada. Use Conexões no admin para adicionar um Postgres (ODK, ERP, etc.).',
    );
  }
  return any[0].id;
}

export interface CreateConnectionInput {
  name: string;
  slug?: string;
  description?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  isDefault?: boolean;
  isOdkSource?: boolean;
}

export async function createConnection(input: CreateConnectionInput): Promise<DbConnection> {
  const pool = getDefaultPool();
  const id = randomUUID();
  const slug =
    input.slug ??
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  if (input.isDefault) {
    await pool.query(`UPDATE gabi_connection SET is_default = false`);
  }

  const passwordEnc = encryptPassword(input.password);

  await query(
    pool,
    `
    INSERT INTO gabi_connection (
      id, name, slug, description, host, port, database_name, db_user,
      password_enc, ssl, is_default, is_odk_source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `,
    [
      id,
      input.name,
      slug,
      input.description ?? null,
      input.host,
      input.port,
      input.database,
      input.user,
      passwordEnc,
      input.ssl ?? false,
      input.isDefault ?? false,
      input.isOdkSource ?? false,
    ],
  );

  const rows = await query<ConnectionRow>(pool, `SELECT * FROM gabi_connection WHERE id = $1`, [id]);
  return mapConnection(rows[0]!);
}

export async function testConnectionConfig(config: DbConfig): Promise<{ ok: boolean; version?: string }> {
  const pool = getPool(`test:${Date.now()}`, config);
  try {
    const r = await pool.query('SELECT version() AS version');
    return { ok: true, version: r.rows[0]?.version as string };
  } finally {
    await pool.end();
  }
}

export async function testConnectionById(connectionId: string): Promise<{ ok: boolean; version?: string }> {
  const row = await getConnectionById(connectionId);
  return testConnectionConfig(connectionToDbConfig(row));
}

export async function markIntrospected(connectionId: string): Promise<void> {
  const pool = getDefaultPool();
  await query(pool, `UPDATE gabi_connection SET last_introspected_at = NOW() WHERE id = $1`, [
    connectionId,
  ]);
}

export interface UpdateConnectionInput {
  name?: string;
  slug?: string;
  description?: string | null;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  isDefault?: boolean;
  isOdkSource?: boolean;
}

export async function updateConnection(
  id: string,
  input: UpdateConnectionInput,
): Promise<DbConnection> {
  const pool = getDefaultPool();
  const row = await getConnectionById(id);

  if (input.isDefault) {
    await pool.query(`UPDATE gabi_connection SET is_default = false WHERE id <> $1`, [id]);
  }

  const name = input.name ?? row.name;
  const slug =
    input.slug ??
    (input.name
      ? input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : row.slug);
  const description =
    input.description !== undefined ? input.description : row.description;
  const host = input.host ?? row.host;
  const port = input.port ?? row.port;
  const database = input.database ?? row.database_name;
  const user = input.user ?? row.db_user;
  const passwordEnc = input.password ? encryptPassword(input.password) : row.password_enc;
  const ssl = input.ssl ?? row.ssl;
  const isDefault = input.isDefault ?? row.is_default;
  const isOdkSource = input.isOdkSource ?? row.is_odk_source;

  await query(
    pool,
    `
    UPDATE gabi_connection SET
      name = $2, slug = $3, description = $4, host = $5, port = $6,
      database_name = $7, db_user = $8, password_enc = $9, ssl = $10,
      is_default = $11, is_odk_source = $12, updated_at = NOW()
    WHERE id = $1
    `,
    [
      id,
      name,
      slug,
      description,
      host,
      port,
      database,
      user,
      passwordEnc,
      ssl,
      isDefault,
      isOdkSource,
    ],
  );

  await closePool(`conn:${id}`);
  const rows = await query<ConnectionRow>(pool, `SELECT * FROM gabi_connection WHERE id = $1`, [id]);
  return mapConnection(rows[0]!);
}

export async function deleteConnection(id: string): Promise<void> {
  const pool = getDefaultPool();
  await getConnectionById(id);
  await query(pool, `DELETE FROM gabi_connection WHERE id = $1`, [id]);
  await closePool(`conn:${id}`);
}
