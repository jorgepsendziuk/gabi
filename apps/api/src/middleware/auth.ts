import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@gabi/core';
import type { PermissionAction } from '@gabi/core';
import {
  buildAbility,
  getUserPermissions,
  verifyToken,
  type AppAbility,
  type AuthUser,
} from '../services/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      ability?: AppAbility;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }
    const token = header.slice(7);
    req.user = verifyToken(token);
    const perms = await getUserPermissions(req.user.id);
    req.ability = buildAbility(perms);
    next();
  } catch {
    next(new UnauthorizedError());
  }
}

export function requirePermission(resource: string, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ability = req.ability;
    if (!ability) {
      next(new UnauthorizedError());
      return;
    }
    if (ability.can('manage', 'all') || ability.can('manage', resource) || ability.can(action, resource)) {
      next();
      return;
    }
    next(new ForbiddenError());
  };
}
