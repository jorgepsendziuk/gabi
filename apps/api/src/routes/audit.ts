import { Router } from 'express';
import { query, getDefaultPool } from '@gabi/db';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);
auditRouter.use(requirePermission('system', 'read'));

auditRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit ?? 50));
    const pool = getDefaultPool();
    const rows = await query(
      pool,
      `
      SELECT id, user_id, ip, entity, entity_id, action, created_at
      FROM gabi_audit_log
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
