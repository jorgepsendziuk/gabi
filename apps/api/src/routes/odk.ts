import { Router } from 'express';
import { getOdkFormSchema, inspectOdkAdmin, listOdkFormIds } from '@gabi/odk';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getConnectionById,
  getConnectionPool,
  getDefaultConnectionId,
} from '../services/connections.js';

export const odkRouter = Router();

odkRouter.use(requireAuth);

odkRouter.get('/overview', requirePermission('system', 'read'), async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string'
        ? req.query.connectionId
        : await getDefaultConnectionId();

    const conn = await getConnectionById(connectionId);
    const pool = await getConnectionPool(connectionId);
    const overview = await inspectOdkAdmin(pool);

    res.json({
      connectionId,
      connection: {
        id: conn.id,
        name: conn.name,
        slug: conn.slug,
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        isOdkSource: conn.is_odk_source,
      },
      ...overview,
    });
  } catch (err) {
    next(err);
  }
});

odkRouter.get('/forms', requirePermission('system', 'read'), async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string'
        ? req.query.connectionId
        : await getDefaultConnectionId();
    const pool = await getConnectionPool(connectionId);
    const forms = await listOdkFormIds(pool);
    res.json({ connectionId, forms });
  } catch (err) {
    next(err);
  }
});

odkRouter.get('/forms/:formId/schema', requirePermission('system', 'read'), async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string'
        ? req.query.connectionId
        : await getDefaultConnectionId();
    const rawFormId = req.params.formId;
    const formId = Array.isArray(rawFormId) ? rawFormId[0] : rawFormId;
    if (!formId) {
      res.status(400).json({ error: 'formId é obrigatório' });
      return;
    }
    const pool = await getConnectionPool(connectionId);
    const schema = await getOdkFormSchema(pool, decodeURIComponent(formId));
    res.json({ connectionId, ...schema });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('não encontrado')) {
      res.status(404).json({ error: message });
      return;
    }
    next(err);
  }
});
