import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { getDefaultPool } from '@gabi/db';

config({ override: true });
config({ path: '.env.local', override: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function migrate() {
  const pool = getDefaultPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gabi_migration (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM gabi_migration WHERE name = $1', [file]);
    if (applied.rowCount && applied.rowCount > 0) {
      console.log(`Skip: ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`Apply: ${file}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO gabi_migration (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
