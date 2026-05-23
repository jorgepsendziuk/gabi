import { config } from 'dotenv';
import { getDefaultPool } from '@gabi/db';

config();

/** Sincroniza conn_default com variáveis DB_* do .env */
async function syncDefaultConnection() {
  const pool = getDefaultPool();
  await pool.query(
    `
    UPDATE gabi_connection SET
      host = $1,
      port = $2,
      database_name = $3,
      db_user = $4,
      updated_at = NOW()
    WHERE slug = 'default'
    `,
    [
      process.env.DB_HOST ?? 'localhost',
      Number(process.env.DB_PORT ?? 5432),
      process.env.DB_NAME ?? 'gabi',
      process.env.DB_USER ?? 'gabi',
    ],
  );
  console.log('Conexão padrão sincronizada com .env');
  await pool.end();
}

syncDefaultConnection().catch(console.error);
