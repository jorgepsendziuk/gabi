import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuditEntry } from '@gabi/core';
import { query, getDefaultPool } from '@gabi/db';

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const pool = getDefaultPool();
  await query(
    pool,
    `
    INSERT INTO gabi_audit_log (id, user_id, ip, user_agent, entity, entity_id, action, before_data, after_data)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      randomUUID(),
      entry.userId ?? null,
      entry.ip ?? null,
      entry.userAgent ?? null,
      entry.entity,
      entry.entityId,
      entry.action,
      entry.before ? JSON.stringify(entry.before) : null,
      entry.after ? JSON.stringify(entry.after) : null,
    ],
  );
}

export function auditMiddleware(entity: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      void writeAudit({
        userId: req.user?.id,
        ip: req.ip,
        userAgent: Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : req.headers['user-agent'],
        entity,
        entityId:
          (body as { id?: string })?.id ??
          (typeof req.params.id === 'string' ? req.params.id : 'batch'),
        action,
        after: body,
      });
      return originalJson(body);
    };
    next();
  };
}
