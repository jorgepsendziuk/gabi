import { Router } from 'express';
import { z } from 'zod';
import { getConfigFromEnv } from '@gabi/db';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createConnection,
  deleteConnection,
  getConnectionById,
  listConnections,
  testConnectionById,
  testConnectionConfig,
  updateConnection,
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

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  host: z.string().min(1).optional(),
  port: z.coerce.number().int().positive().optional(),
  database: z.string().min(1).optional(),
  user: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
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
    res.json(await listConnections());
  } catch (err) {
    next(err);
  }
});

/** Template Supabase derivado do banco meta (.env) — facilita cadastro de conexões. */
connectionsRouter.get(
  '/supabase-template',
  requirePermission('connections', 'read'),
  async (_req, res) => {
    const cfg = getConfigFromEnv();
    const isSupabase =
      Boolean(cfg.ssl) &&
      (cfg.host.includes('supabase.com') || cfg.host.includes('supabase.co'));

    if (!isSupabase) {
      res.json({ available: false as const });
      return;
    }

    const refFromUser = cfg.user.match(/\.([a-z0-9]{15,25})$/i)?.[1];
    const refFromHost = cfg.host.match(/^db\.([a-z0-9]{15,25})\.supabase\.co$/i)?.[1];
    const projectRef = refFromUser ?? refFromHost;

    const poolerUser =
      projectRef && !cfg.user.includes('.')
        ? `postgres.${projectRef}`
        : cfg.user.replace(/^gabi_api\./i, 'postgres.');

    res.json({
      available: true as const,
      projectRef,
      meta: {
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: poolerUser,
        ssl: cfg.ssl,
      },
      direct: projectRef
        ? {
            host: `db.${projectRef}.supabase.co`,
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            ssl: true,
          }
        : undefined,
      hints: {
        sessionPoolerPort: 5432,
        transactionPoolerPort: 6543,
        uriPath: 'Supabase Dashboard → Project Settings → Database → Connection string',
      },
    });
  },
);

connectionsRouter.get('/:id', requirePermission('connections', 'read'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const row = await getConnectionById(id);
    res.json({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      host: row.host,
      port: row.port,
      database: row.database_name,
      user: row.db_user,
      ssl: row.ssl,
      isDefault: row.is_default,
      isOdkSource: row.is_odk_source,
      lastIntrospectedAt: row.last_introspected_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
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

connectionsRouter.patch('/:id', requirePermission('connections', 'manage'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const body = updateSchema.parse(req.body);
    const before = await getConnectionById(id);
    const conn = await updateConnection(id, body);
    await writeAudit({
      userId: req.user?.id,
      entity: 'connection',
      entityId: id,
      action: 'UPDATE',
      before: { name: before.name, host: before.host },
      after: { ...conn, password: '[redacted]' },
    });
    res.json(conn);
  } catch (err) {
    next(err);
  }
});

connectionsRouter.delete('/:id', requirePermission('connections', 'manage'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const before = await getConnectionById(id);
    await deleteConnection(id);
    await writeAudit({
      userId: req.user?.id,
      entity: 'connection',
      entityId: id,
      action: 'DELETE',
      before: { name: before.name, host: before.host },
    });
    res.status(204).send();
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
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
      res.json(await testConnectionById(id));
    } catch (err) {
      next(err);
    }
  },
);
