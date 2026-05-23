import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { getDefaultPool } from '@gabi/db';

config();

async function seed() {
  const pool = getDefaultPool();
  const adminId = randomUUID();
  const adminRoleId = randomUUID();
  const email = process.env.ADMIN_EMAIL ?? 'admin@gabi.local';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO gabi_role (id, name) VALUES ($1, 'admin')
     ON CONFLICT (name) DO NOTHING`,
    [adminRoleId],
  );

  const roleRow = await pool.query(`SELECT id FROM gabi_role WHERE name = 'admin'`);
  const roleId = roleRow.rows[0]?.id ?? adminRoleId;

  await pool.query(
    `INSERT INTO gabi_user (id, email, password_hash, name)
     VALUES ($1, $2, $3, 'Administrador')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [adminId, email, hash],
  );

  const userRow = await pool.query(`SELECT id FROM gabi_user WHERE email = $1`, [email]);
  const userId = userRow.rows[0]?.id;

  await pool.query(
    `INSERT INTO gabi_user_role (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );

  const perms = [
    { resource: '*', action: 'manage' },
    { resource: 'system', action: 'read' },
    { resource: 'system', action: 'manage' },
    { resource: 'connections', action: 'read' },
    { resource: 'connections', action: 'manage' },
  ];

  for (const p of perms) {
    const permId = randomUUID();
    await pool.query(
      `INSERT INTO gabi_permission (id, resource, action) VALUES ($1, $2, $3)
       ON CONFLICT (resource, action) DO NOTHING`,
      [permId, p.resource, p.action],
    );
    const permRow = await pool.query(
      `SELECT id FROM gabi_permission WHERE resource = $1 AND action = $2`,
      [p.resource, p.action],
    );
    await pool.query(
      `INSERT INTO gabi_role_permission (role_id, permission_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [roleId, permRow.rows[0]?.id],
    );
  }

  console.log(`Admin: ${email} / ${password}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
