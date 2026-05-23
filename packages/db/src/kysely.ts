import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

export interface Database {
  [key: string]: Record<string, unknown>;
}

export function createKysely(pool: pg.Pool): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

export { sql };
