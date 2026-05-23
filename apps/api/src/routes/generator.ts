import { Router } from 'express';
import { z } from 'zod';
import { generatePage } from '@gabi/generator';
import { introspectDatabase } from '@gabi/introspector';
import { detectOdkTable } from '@gabi/odk';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { saveDataSource, savePage, addPermissionsForResource, loadPages } from '../services/store.js';
import { getConnectionPool, getDefaultConnectionId, getConnectionById } from '../services/connections.js';
import { inferOdkDataSourceFlags } from '../services/odk-overlay.js';
import { writeAudit } from '../middleware/audit.js';

export const generatorRouter = Router();

generatorRouter.use(requireAuth);

const generateBodySchema = z.object({
  connectionId: z.string().optional(),
  schema: z.string(),
  table: z.string(),
  template: z.enum(['list', 'map']).default('list'),
  label: z.string().optional(),
});

generatorRouter.get('/pages', async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string' ? req.query.connectionId : undefined;
    const pages = await loadPages(connectionId);
    res.json(pages);
  } catch (err) {
    next(err);
  }
});

generatorRouter.post(
  '/pages',
  requirePermission('system', 'manage'),
  async (req, res, next) => {
    try {
      const body = generateBodySchema.parse(req.body);
      const connectionId = body.connectionId ?? (await getDefaultConnectionId());
      const pool = await getConnectionPool(connectionId);
      const intro = await introspectDatabase(pool);
      const table = intro.tables.find((t) => t.schema === body.schema && t.name === body.table);
      if (!table) {
        res.status(404).json({ error: 'Tabela não encontrada nesta conexão' });
        return;
      }

      const conn = await getConnectionById(connectionId);
      const odk = detectOdkTable(table);
      const useOdkOverlay = Boolean(conn.is_odk_source) || odk.isOdkTable;
      const odkFlags = useOdkOverlay
        ? inferOdkDataSourceFlags(table, true)
        : { odkReadOnly: false as const, recordKeyColumn: undefined };

      const generated = generatePage({
        connectionId,
        table,
        type: body.template,
        label: body.label,
        odkReadOnly: odkFlags.odkReadOnly,
        recordKeyColumn: odkFlags.recordKeyColumn,
      });

      await saveDataSource(generated.dataSource);
      await savePage(generated.page);
      await addPermissionsForResource(
        generated.page.resource,
        generated.permissions.map((p) => p.action),
      );

      await writeAudit({
        userId: req.user?.id,
        entity: 'page',
        entityId: generated.page.id,
        action: 'CREATE',
        after: generated,
      });

      res.status(201).json(generated);
    } catch (err) {
      next(err);
    }
  },
);
