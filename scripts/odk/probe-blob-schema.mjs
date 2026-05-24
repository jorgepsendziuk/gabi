import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, '../../apps/api/.env') });

const meta = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const conn = (
  await meta.query(
    `SELECT host, port, database_name, db_user, password_enc, ssl
     FROM gabi_connection WHERE is_odk_source = true AND enabled = true LIMIT 1`,
  )
).rows[0];

// decrypt minimal - use connections from env if needed
import { createDecipheriv, scryptSync } from 'node:crypto';
function decrypt(enc) {
  const secret = process.env.CONNECTION_SECRET ?? process.env.JWT_SECRET ?? 'gabi-dev-secret';
  const key = scryptSync(secret, 'gabi-salt', 32);
  const parts = enc.split(':');
  const tag = Buffer.from(parts[1], 'hex');
  const data = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.alloc(16, 0));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const odk = new pg.Pool({
  host: conn.host,
  port: conn.port,
  database: conn.database_name,
  user: conn.db_user,
  password: decrypt(conn.password_enc),
  ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
});

const tables = [
  '_form_info',
  '_form_info_fileset',
  '_form_info_xform_bin',
  '_form_info_xform_ref',
  '_form_info_xform_blb',
  '_form_data_model',
];

for (const t of tables) {
  const r = await odk.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'odk_prod' AND table_name = $1 ORDER BY ordinal_position`,
    [t],
  );
  console.log('\n##', t);
  for (const row of r.rows) console.log(' ', row.column_name, row.data_type);
}

const forms = await odk.query(`SELECT "_URI", "FORM_ID" FROM odk_prod._form_info LIMIT 2`);
console.log('\nforms sample:', forms.rows);

await meta.end();
await odk.end();
