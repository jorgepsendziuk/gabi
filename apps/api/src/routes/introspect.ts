import { Router } from 'express';
import { introspectDatabase } from '@gabi/introspector';
import { detectOdkTable } from '@gabi/odk';
import { suggestPageTypes } from '@gabi/generator';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getConnectionPool,
  getDefaultConnectionId,
  markIntrospected,
} from '../services/connections.js';

export const introspectRouter = Router();

introspectRouter.use(requireAuth);

introspectRouter.get('/', requirePermission('system', 'read'), async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string'
        ? req.query.connectionId
        : await getDefaultConnectionId();

    const pool = await getConnectionPool(connectionId);
    const result = await introspectDatabase(pool);
    await markIntrospected(connectionId);

    const enriched = result.tables.map((t) => ({
      ...t,
      connectionId,
      suggestedPages: suggestPageTypes(t),
      odk: detectOdkTable(t),
    }));

    res.json({ ...result, connectionId, tables: enriched });
  } catch (err) {
    next(err);
  }
});
