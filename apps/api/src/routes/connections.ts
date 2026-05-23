import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createConnection,
  listConnections,
  testConnectionById,
  testConnectionConfig,
} from '../services/connections.js';
import { writeAudit } from '../middleware/audit.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isOdkSource: z.boolean().optional(),
});

const testSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().optional(),
});

export const connectionsRouter = Router();

connectionsRouter.use(requireAuth);

connectionsRouter.get('/', requirePermission('connections', 'read'), async (_req, res, next) => {
  try {
    const connections = await listConnections();
    res.json(connections);
  } catch (err) {
    next(err);
  }
});

connectionsRouter.post('/', requirePermission('connections', 'manage'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const conn = await createConnection(body);
    await writeAudit({
      userId: req.user?.id,
      entity: 'connection',
      entityId: conn.id,
      action: 'CREATE',
      after: { ...conn, password: '[redacted]' },
    });
    res.status(201).json(conn);
  } catch (err) {
    next(err);
  }
});

connectionsRouter.post('/test', requirePermission('connections', 'manage'), async (req, res, next) => {
  try {
    const body = testSchema.parse(req.body);
    const result = await testConnectionConfig({
      host: body.host,
      port: body.port,
      database: body.database,
      user: body.user,
      password: body.password,
      ssl: body.ssl,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

connectionsRouter.post(
  '/:id/test',
  requirePermission('connections', 'read'),
  async (req, res, next) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const result = await testConnectionById(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
