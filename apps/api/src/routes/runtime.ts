import { Router } from 'express';
import { z } from 'zod';
import { DynamicRepository, listQuerySchema } from '@gabi/runtime';
import { requireAuth } from '../middleware/auth.js';
import { loadDataSources } from '../services/store.js';
import { getConnectionPool, getConnectionById } from '../services/connections.js';
import { writeAudit } from '../middleware/audit.js';
import { NotFoundError, GabiError } from '@gabi/core';
import { OdkOverlayService, isOdkOverlayDataSource } from '../services/odk-overlay.js';
import { getDefaultPool } from '@gabi/db';

export const runtimeRouter = Router();

runtimeRouter.use(requireAuth);

async function resolveDataSource(dataSourceId: string) {
  const sources = await loadDataSources();
  const ds = sources.get(dataSourceId);
  if (!ds) throw new NotFoundError(`DataSource não encontrada: ${dataSourceId}`);
  return ds;
}

async function getReaders(dataSourceId: string) {
  const ds = await resolveDataSource(dataSourceId);
  const sources = await loadDataSources();
  const pool = await getConnectionPool(ds.connectionId);
  const repo = new DynamicRepository(pool, sources);
  const overlay = isOdkOverlayDataSource(ds) ? new OdkOverlayService(repo) : null;
  return { ds, repo, overlay };
}

function assertWriteAllowed(ds: Awaited<ReturnType<typeof resolveDataSource>>) {
  if (ds.odkReadOnly) return;
  throw new GabiError(
    'Esta fonte não usa overlay ODK. Escrita direta no banco externo não está habilitada no MVP.',
    'WRITE_NOT_ALLOWED',
    403,
  );
}

runtimeRouter.get('/:dataSourceId/records', async (req, res, next) => {
  try {
    const resource = req.params.dataSourceId.replace(/[^a-zA-Z0-9._:-]/g, '_');
    const ability = req.ability;
    if (
      !ability?.can('manage', 'all') &&
      !ability?.can('read', resource) &&
      !ability?.can('read', req.params.dataSourceId)
    ) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const params = listQuerySchema.parse(req.query);
    const { ds, repo, overlay } = await getReaders(req.params.dataSourceId);
    const result = overlay
      ? await overlay.list(ds, req.params.dataSourceId, params)
      : await repo.list(req.params.dataSourceId, params);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

runtimeRouter.get('/:dataSourceId/records/:recordId', async (req, res, next) => {
  try {
    const { ds, repo, overlay } = await getReaders(req.params.dataSourceId);
    const recordId = decodeURIComponent(req.params.recordId);
    const row = overlay
      ? await overlay.getById(ds, req.params.dataSourceId, recordId)
      : await repo.getById(req.params.dataSourceId, recordId);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

const mutateBodySchema = z.record(z.unknown());

runtimeRouter.post('/:dataSourceId/records', async (req, res, next) => {
  try {
    const { ds, overlay } = await getReaders(req.params.dataSourceId);
    if (!overlay) {
      assertWriteAllowed(ds);
      return;
    }
    const body = mutateBodySchema.parse(req.body);
    const created = await overlay.create(ds, body as Record<string, unknown>, req.user?.id);
    await writeAudit({
      userId: req.user?.id,
      entity: ds.id,
      entityId: String(created[ds.recordKeyColumn ?? '_uuid'] ?? 'new'),
      action: 'CREATE',
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

runtimeRouter.patch('/:dataSourceId/records/:recordId', async (req, res, next) => {
  try {
    const { ds, overlay } = await getReaders(req.params.dataSourceId);
    if (!overlay) {
      assertWriteAllowed(ds);
      return;
    }
    const recordId = decodeURIComponent(req.params.recordId);
    const patch = mutateBodySchema.parse(req.body);
    const updated = await overlay.update(
      ds,
      req.params.dataSourceId,
      recordId,
      patch as Record<string, unknown>,
      req.user?.id,
    );
    await writeAudit({
      userId: req.user?.id,
      entity: ds.id,
      entityId: recordId,
      action: 'UPDATE',
      after: updated,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

runtimeRouter.delete('/:dataSourceId/records/:recordId', async (req, res, next) => {
  try {
    const { ds, overlay } = await getReaders(req.params.dataSourceId);
    if (!overlay) {
      assertWriteAllowed(ds);
      return;
    }
    const recordId = decodeURIComponent(req.params.recordId);
    await overlay.remove(ds, recordId, req.user?.id);
    await writeAudit({
      userId: req.user?.id,
      entity: ds.id,
      entityId: recordId,
      action: 'DELETE',
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runtimeRouter.get('/:dataSourceId/geojson', async (req, res, next) => {
  try {
    const params = listQuerySchema.parse(req.query);
    const { ds, repo, overlay } = await getReaders(req.params.dataSourceId);
    const geojson = overlay
      ? await overlay.listGeoJson(ds, req.params.dataSourceId, params)
      : await repo.listGeoJson(req.params.dataSourceId, params);
    res.json(geojson);
  } catch (err) {
    next(err);
  }
});

runtimeRouter.get('/:dataSourceId/export.csv', async (req, res, next) => {
  try {
    const resource = req.params.dataSourceId.replace(/[^a-zA-Z0-9._:-]/g, '_');
    if (
      !req.ability?.can('manage', 'all') &&
      !req.ability?.can('export', resource) &&
      !req.ability?.can('read', resource)
    ) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const params = listQuerySchema.parse(req.query);
    const { ds, repo, overlay } = await getReaders(req.params.dataSourceId);
    const csv = overlay
      ? await exportOverlayCsv(overlay, ds, req.params.dataSourceId, params)
      : await repo.exportCsv(req.params.dataSourceId, params);
    await writeAudit({
      userId: req.user?.id,
      entity: resource,
      entityId: req.params.dataSourceId,
      action: 'EXPORT',
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${resource}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/** Marca conexão como fonte ODK e opcionalmente reclassifica data sources existentes */
runtimeRouter.post('/connections/:connectionId/odk-sync', async (req, res, next) => {
  try {
    const connectionId = req.params.connectionId;
    await getConnectionById(connectionId);
    const meta = getDefaultPool();
    await meta.query(`UPDATE gabi_connection SET is_odk_source = true WHERE id = $1`, [
      connectionId,
    ]);
    res.json({ ok: true, connectionId, message: 'Conexão marcada como fonte ODK' });
  } catch (err) {
    next(err);
  }
});

async function exportOverlayCsv(
  overlay: OdkOverlayService,
  ds: Awaited<ReturnType<typeof resolveDataSource>>,
  dataSourceId: string,
  params: Parameters<OdkOverlayService['list']>[2],
): Promise<string> {
  const result = await overlay.list(ds, dataSourceId, { ...params, page: 1, pageSize: 10000 });
  const cols = ds.columns.filter((c) => !c.isGeometry && c.name !== '_gabi').map((c) => c.name);
  const header = [...cols, '_gabi_hasLocalChanges'].join(',');
  const lines = result.data.map((row) => {
    const gabi = row._gabi as { hasLocalChanges?: boolean } | undefined;
    return [...cols.map((c) => JSON.stringify(row[c] ?? '')), JSON.stringify(gabi?.hasLocalChanges ?? false)].join(',');
  });
  return [header, ...lines].join('\n');
}
