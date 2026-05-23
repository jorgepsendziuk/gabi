import pg from 'pg';

const pools = new Map<string, pg.Pool>();

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export function getConnectionString(config: DbConfig): string {
  const ssl = config.ssl ? '?sslmode=require' : '';
  return `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}${ssl}`;
}

export function getPool(key: string, config: DbConfig): pg.Pool {
  const existing = pools.get(key);
  if (existing) return existing;

  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: 20,
  });

  pools.set(key, pool);
  return pool;
}

export function getDefaultPool(): pg.Pool {
  const config = getConfigFromEnv();
  return getPool('default', config);
}

export function getConfigFromEnv(): DbConfig {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'gabi',
    user: process.env.DB_USER ?? 'gabi',
    password: process.env.DB_PASSWORD ?? 'gabi',
    ssl: process.env.DB_SSL === 'true',
  };
}

export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  pool: pg.Pool,
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function closePool(key: string): Promise<void> {
  const pool = pools.get(key);
  if (pool) {
    await pool.end();
    pools.delete(key);
  }
}
