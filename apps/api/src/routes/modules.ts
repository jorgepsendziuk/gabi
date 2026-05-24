import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createModule,
  deleteModule,
  getModuleById,
  listModules,
  updateModule,
} from '../services/modules.js';
import { writeAudit } from '../middleware/audit.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(40).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const updateSchema = createSchema.partial();

export const modulesRouter = Router();

modulesRouter.use(requireAuth);

modulesRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await listModules());
  } catch (err) {
    next(err);
  }
});

modulesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    res.json(await getModuleById(id));
  } catch (err) {
    next(err);
  }
});

modulesRouter.post('/', requirePermission('system', 'manage'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const mod = await createModule(body);
    await writeAudit({
      userId: req.user?.id,
      entity: 'module',
      entityId: mod.id,
      action: 'CREATE',
      after: mod,
    });
    res.status(201).json(mod);
  } catch (err) {
    next(err);
  }
});

modulesRouter.patch('/:id', requirePermission('system', 'manage'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const body = updateSchema.parse(req.body);
    const before = await getModuleById(id);
    const mod = await updateModule(id, body);
    await writeAudit({
      userId: req.user?.id,
      entity: 'module',
      entityId: id,
      action: 'UPDATE',
      before: { name: before.name },
      after: { name: mod.name },
    });
    res.json(mod);
  } catch (err) {
    next(err);
  }
});

modulesRouter.delete('/:id', requirePermission('system', 'manage'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const before = await getModuleById(id);
    await deleteModule(id);
    await writeAudit({
      userId: req.user?.id,
      entity: 'module',
      entityId: id,
      action: 'DELETE',
      before: { name: before.name },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
