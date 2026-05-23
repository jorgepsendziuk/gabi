import type { PermissionAction, User } from '@gabi/core';
import { UnauthorizedError } from '@gabi/core';
import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getDefaultPool } from '@gabi/db';

export type AppAbility = MongoAbility<[PermissionAction | 'manage', string]>;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser> {
  const pool = getDefaultPool();
  const rows = await query<{ id: string; email: string; name: string | null; password_hash: string }>(
    pool,
    `SELECT id, email, name, password_hash FROM gabi_user WHERE email = $1`,
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError('Credenciais inválidas');
  }
  return { id: user.id, email: user.email, name: user.name ?? undefined };
}

export async function getUserPermissions(userId: string): Promise<Array<{ resource: string; action: string }>> {
  const pool = getDefaultPool();
  return query(
    pool,
    `
    SELECT DISTINCT p.resource, p.action
    FROM gabi_permission p
    JOIN gabi_role_permission rp ON rp.permission_id = p.id
    JOIN gabi_user_role ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = $1
    `,
    [userId],
  );
}

export function buildAbility(permissions: Array<{ resource: string; action: string }>): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const p of permissions) {
    can(p.action as PermissionAction | 'manage', p.resource);
    if (p.action === 'manage' || p.resource === '*') {
      can('manage', 'all');
    }
  }

  return build();
}

export function signAccessToken(user: AuthUser): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1h') as jwt.SignOptions['expiresIn'];
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn });
}

export function verifyToken(token: string): AuthUser {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const payload = jwt.verify(token, secret) as { sub: string; email: string };
  return { id: payload.sub, email: payload.email };
}

export async function getUserWithRoles(userId: string): Promise<User> {
  const pool = getDefaultPool();
  const userRows = await query<{ id: string; email: string; name: string | null }>(
    pool,
    `SELECT id, email, name FROM gabi_user WHERE id = $1`,
    [userId],
  );
  const u = userRows[0];
  if (!u) throw new UnauthorizedError();

  const perms = await getUserPermissions(userId);
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? undefined,
    roles: [
      {
        id: 'default',
        name: 'user',
        permissions: perms.map((p, i) => ({
          id: String(i),
          resource: p.resource,
          action: p.action as PermissionAction,
        })),
      },
    ],
  };
}
