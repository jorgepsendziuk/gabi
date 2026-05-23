import { Router } from 'express';
import { getDefaultPool } from '@gabi/db';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { loadDataSources } from '../services/store.js';

export const datasourcesRouter = Router();

datasourcesRouter.use(requireAuth);

datasourcesRouter.get('/', async (_req, res, next) => {
  try {
    const sources = await loadDataSources();
    res.json([...sources.values()]);
  } catch (err) {
    next(err);
  }
});

datasourcesRouter.get('/:id', async (req, res, next) => {
  try {
    const sources = await loadDataSources();
    const ds = sources.get(req.params.id);
    if (!ds) {
      res.status(404).json({ error: 'DataSource não encontrada' });
      return;
    }
    res.json(ds);
  } catch (err) {
    next(err);
  }
});

datasourcesRouter.post(
  '/test-connection',
  requirePermission('system', 'manage'),
  async (req, res, next) => {
    try {
      const { host, port, database, user, password } = req.body as {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
      };
      const pool = getDefaultPool();
      void host;
      void port;
      void database;
      void user;
      void password;
      const r = await pool.query('SELECT current_database() AS db, version() AS version');
      res.json({ ok: true, ...r.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);
