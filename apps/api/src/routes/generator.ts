import { Router, type Request } from 'express';
import { z } from 'zod';
import { generatePage } from '@gabi/generator';
import { introspectDatabase } from '@gabi/introspector';
import { detectOdkForms, detectOdkTable } from '@gabi/odk';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  saveDataSource,
  savePage,
  addPermissionsForResource,
  loadPages,
  loadDataSources,
  getPageById,
  getPagesByDataSourceId,
  updatePage,
  deletePage,
} from '../services/store.js';
import { NotFoundError } from '@gabi/core';
import { resolvePageScope } from '../services/page-access.js';
import { ForbiddenError } from '@gabi/core';
import { getConnectionPool, getDefaultConnectionId, getConnectionById } from '../services/connections.js';
import { inferOdkDataSourceFlags } from '../services/odk-overlay.js';
import { writeAudit } from '../middleware/audit.js';

export const generatorRouter = Router();

generatorRouter.use(requireAuth);

const generateBodySchema = z.object({
  connectionId: z.string().optional(),
  schema: z.string(),
  table: z.string(),
  template: z.enum(['list', 'map', 'report', 'dashboard']).default('list'),
  label: z.string().optional(),
  moduleId: z.string().optional(),
  scope: z.enum(['private', 'global']).default('global'),
});

function canManagePage(
  userId: string | undefined,
  page: Awaited<ReturnType<typeof getPageById>>,
  ability: Request['ability'],
): boolean {
  if (ability?.can('manage', 'all') || ability?.can('manage', 'system')) return true;
  return page.scope === 'private' && page.ownerUserId === userId;
}

const generateOdkFormsSchema = z.object({
  connectionId: z.string().optional(),
  formIds: z.array(z.string()).optional(),
  template: z.enum(['list', 'map', 'report', 'dashboard']).default('list'),
  moduleId: z.string().optional(),
});

generatorRouter.get('/data-sources/:dataSourceId', async (req, res, next) => {
  try {
    const sources = await loadDataSources();
    const ds = sources.get(req.params.dataSourceId);
    if (!ds) throw new NotFoundError(`DataSource não encontrada: ${req.params.dataSourceId}`);
    const linkedPages = (await getPagesByDataSourceId(ds.id))
      .filter((p) => p.type === 'report')
      .map((p) => ({ id: p.id, resource: p.resource, label: p.label, type: p.type }));
    res.json({
      id: ds.id,
      schema: ds.schema,
      table: ds.table,
      recordKeyColumn: ds.recordKeyColumn,
      primaryKey: ds.primaryKey,
      odkReadOnly: ds.odkReadOnly ?? false,
      columns: ds.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        isGeometry: c.isGeometry,
        isNullable: c.isNullable,
      })),
      reports: linkedPages,
    });
  } catch (err) {
    next(err);
  }
});

generatorRouter.get('/pages', async (req, res, next) => {
  try {
    const connectionId =
      typeof req.query.connectionId === 'string' ? req.query.connectionId : undefined;
    const moduleId =
      typeof req.query.moduleId === 'string' ? req.query.moduleId : undefined;
    const pages = await loadPages({
      connectionId,
      moduleId,
      userId: req.user?.id,
      ability: req.ability,
    });
    res.json(pages);
  } catch (err) {
    next(err);
  }
});

const updatePageSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  scope: z.enum(['private', 'global']).optional(),
  moduleId: z.string().nullable().optional(),
});

generatorRouter.get('/pages/:id', requirePermission('system', 'read'), async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    res.json(await getPageById(id));
  } catch (err) {
    next(err);
  }
});

generatorRouter.patch('/pages/:id', async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const body = updatePageSchema.parse(req.body);
    const before = await getPageById(id);
    if (!canManagePage(req.user?.id, before, req.ability)) {
      throw new ForbiddenError();
    }
    const scopePatch = body.scope
      ? resolvePageScope(body.scope, req.user?.id)
      : undefined;
    const page = await updatePage(id, {
      label: body.label,
      config: body.config,
      scope: scopePatch?.scope,
      ownerUserId: scopePatch ? scopePatch.ownerUserId ?? null : undefined,
      moduleId: body.moduleId,
    });
    await writeAudit({
      userId: req.user?.id,
      entity: 'page',
      entityId: id,
      action: 'UPDATE',
      before: { label: before.label, scope: before.scope },
      after: { label: page.label, scope: page.scope },
    });
    res.json(page);
  } catch (err) {
    next(err);
  }
});

generatorRouter.delete('/pages/:id', async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]!;
    const before = await getPageById(id);
    if (!canManagePage(req.user?.id, before, req.ability)) {
      throw new ForbiddenError();
    }
    await deletePage(id);
    await writeAudit({
      userId: req.user?.id,
      entity: 'page',
      entityId: id,
      action: 'DELETE',
      before: { label: before.label, resource: before.resource },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

generatorRouter.post(
  '/odk-forms',
  requirePermission('system', 'manage'),
  async (req, res, next) => {
    try {
      const body = generateOdkFormsSchema.parse(req.body);
      const connectionId = body.connectionId ?? (await getDefaultConnectionId());
      const pool = await getConnectionPool(connectionId);
      const intro = await introspectDatabase(pool);
      const conn = await getConnectionById(connectionId);
      const odkOpts = { connectionIsOdkSource: Boolean(conn.is_odk_source) };

      const forms = detectOdkForms(intro.tables, intro.foreignKeys, odkOpts);

      const selected = body.formIds?.length
        ? forms.filter((f) => body.formIds!.includes(f.id))
        : forms;

      const created: Array<{ formId: string; pageId: string; label: string }> = [];
      const skipped: Array<{ formId: string; reason: string }> = [];

      for (const form of selected) {
        if (!form.suggestedPages.includes(body.template)) {
          skipped.push({ formId: form.id, reason: `Template ${body.template} não sugerido` });
          continue;
        }

        const table = intro.tables.find(
          (t) => t.schema === form.schema && t.name === form.mainTable,
        );
        if (!table) {
          skipped.push({ formId: form.id, reason: 'Tabela principal não encontrada' });
          continue;
        }

        const odkFlags = inferOdkDataSourceFlags(table, true);
        const scopeResolved = resolvePageScope('global', req.user?.id);
        const generated = generatePage({
          connectionId,
          table,
          type: body.template,
          label: form.label,
          moduleId: body.moduleId ?? 'mod_default',
          scope: scopeResolved.scope,
          ownerUserId: scopeResolved.ownerUserId,
          odkReadOnly: odkFlags.odkReadOnly,
          recordKeyColumn: odkFlags.recordKeyColumn,
        });

        await saveDataSource(generated.dataSource);
        await savePage(generated.page);
        if (generated.page.scope === 'global') {
          await addPermissionsForResource(
            generated.page.resource,
            generated.permissions.map((p) => p.action),
          );
        }

        created.push({
          formId: form.id,
          pageId: generated.page.id,
          label: generated.page.label,
        });
      }

      await writeAudit({
        userId: req.user?.id,
        entity: 'odk_forms',
        entityId: connectionId,
        action: 'BULK_CREATE',
        after: { created, skipped, template: body.template },
      });

      res.status(201).json({
        connectionId,
        template: body.template,
        created,
        skipped,
        formsDetected: forms.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

const createDashboardSchema = z.object({
  connectionId: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().optional(),
  label: z.string().optional(),
  moduleId: z.string().optional(),
  scope: z.enum(['private', 'global']).default('global'),
});

generatorRouter.post(
  '/dashboards',
  requirePermission('system', 'manage'),
  async (req, res, next) => {
    try {
      const body = createDashboardSchema.parse(req.body);
      const connectionId = body.connectionId ?? (await getDefaultConnectionId());
      const pool = await getConnectionPool(connectionId);
      const intro = await introspectDatabase(pool);

      let table = body.schema && body.table
        ? intro.tables.find((t) => t.schema === body.schema && t.name === body.table)
        : undefined;

      if (!table) {
        table = intro.tables.find(
          (t) => t.type === 'table' && !t.schema.startsWith('pg_') && t.name !== 'spatial_ref_sys',
        );
      }

      if (!table) {
        res.status(404).json({ error: 'Nenhuma tabela disponível nesta conexão para ancorar o dashboard' });
        return;
      }

      const conn = await getConnectionById(connectionId);
      const odkOpts = { connectionIsOdkSource: Boolean(conn.is_odk_source) };
      const odk = detectOdkTable(table, odkOpts);
      const useOdkOverlay = Boolean(conn.is_odk_source) || odk.isOdkTable;
      const odkFlags = useOdkOverlay
        ? inferOdkDataSourceFlags(table, true)
        : { odkReadOnly: false as const, recordKeyColumn: undefined };

      const scopeResolved = resolvePageScope(body.scope, req.user?.id);
      const generated = generatePage({
        connectionId,
        table,
        type: 'dashboard',
        label: body.label ?? `${table.schema}.${table.name}`,
        moduleId: body.moduleId ?? 'mod_default',
        scope: scopeResolved.scope,
        ownerUserId: scopeResolved.ownerUserId,
        odkReadOnly: odkFlags.odkReadOnly,
        recordKeyColumn: odkFlags.recordKeyColumn,
      });

      await saveDataSource(generated.dataSource);
      await savePage(generated.page);
      if (generated.page.scope === 'global') {
        await addPermissionsForResource(
          generated.page.resource,
          generated.permissions.map((p) => p.action),
        );
      }

      await writeAudit({
        userId: req.user?.id,
        entity: 'page',
        entityId: generated.page.id,
        action: 'CREATE',
        after: { type: 'dashboard', resource: generated.page.resource },
      });

      res.status(201).json(generated.page);
    } catch (err) {
      next(err);
    }
  },
);

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
      const odkOpts = { connectionIsOdkSource: Boolean(conn.is_odk_source) };
      const odk = detectOdkTable(table, odkOpts);
      const useOdkOverlay = Boolean(conn.is_odk_source) || odk.isOdkTable;
      const odkFlags = useOdkOverlay
        ? inferOdkDataSourceFlags(table, true)
        : { odkReadOnly: false as const, recordKeyColumn: undefined };

      const scopeResolved = resolvePageScope(body.scope, req.user?.id);
      const generated = generatePage({
        connectionId,
        table,
        type: body.template,
        label: body.label,
        moduleId: body.moduleId ?? 'mod_default',
        scope: scopeResolved.scope,
        ownerUserId: scopeResolved.ownerUserId,
        odkReadOnly: odkFlags.odkReadOnly,
        recordKeyColumn: odkFlags.recordKeyColumn,
      });

      await saveDataSource(generated.dataSource);
      await savePage(generated.page);
      if (generated.page.scope === 'global') {
        await addPermissionsForResource(
          generated.page.resource,
          generated.permissions.map((p) => p.action),
        );
      }

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
