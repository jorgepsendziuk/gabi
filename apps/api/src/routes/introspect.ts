import { Router } from 'express';
import { introspectDatabase } from '@gabi/introspector';
import { detectOdkForms, detectOdkTable } from '@gabi/odk';
import { suggestPageTypes } from '@gabi/generator';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getConnectionById,
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

    const conn = await getConnectionById(connectionId);
    const odkOpts = { connectionIsOdkSource: Boolean(conn.is_odk_source) };

    const pool = await getConnectionPool(connectionId);
    const result = await introspectDatabase(pool);
    await markIntrospected(connectionId);

    const odkForms = detectOdkForms(result.tables, result.foreignKeys, odkOpts);

    const enriched = result.tables.map((t) => ({
      ...t,
      connectionId,
      suggestedPages: suggestPageTypes(t),
      odk: detectOdkTable(t, odkOpts),
    }));

    res.json({
      ...result,
      connectionId,
      connectionIsOdkSource: conn.is_odk_source,
      odkForms,
      tables: enriched,
    });
  } catch (err) {
    next(err);
  }
});
