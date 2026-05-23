import type { DataSource, ListQuery, ListResult } from '@gabi/core';
import { NotFoundError } from '@gabi/core';
import { DynamicRepository } from '@gabi/runtime';
import {
  attachGabiMeta,
  mergeListWithChanges,
  applyChangesToRow,
  resolveRecordKeyColumn,
} from '@gabi/odk';
import { randomUUID } from 'node:crypto';
import {
  appendOdkChange,
  loadChangesForDataSource,
  resolveRecordKeyFromId,
} from './odk-changes.js';
import { buildRecordKeyJson, recordKeyToString } from '@gabi/odk';

export class OdkOverlayService {
  constructor(
    private readonly sourceRepo: DynamicRepository,
  ) {}

  private getKeyColumn(ds: DataSource): string {
    return ds.recordKeyColumn ?? ds.primaryKey[0] ?? '_uuid';
  }

  async list(ds: DataSource, dataSourceId: string, params: ListQuery): Promise<ListResult> {
    const base = await this.sourceRepo.list(dataSourceId, params);
    const changes = await loadChangesForDataSource(ds);
    const keyCol = this.getKeyColumn(ds);

    const merged = mergeListWithChanges(base.data, changes, keyCol);
    const data = merged.map(attachGabiMeta);

    const createCount = changes.filter((c) => c.operation === 'CREATE').length;
    const deleteCount = new Set(
      changes.filter((c) => c.operation === 'DELETE').map((c) => c.recordKey),
    ).size;

    return {
      data,
      total: Math.max(0, base.total - deleteCount) + createCount,
      page: base.page,
      pageSize: base.pageSize,
      odkOverlay: true,
    } as ListResult & { odkOverlay: boolean };
  }

  async getById(
    ds: DataSource,
    dataSourceId: string,
    recordId: string,
  ): Promise<Record<string, unknown>> {
    const recordKeyJson = resolveRecordKeyFromId(ds, recordId);
    const keyCol = Object.keys(recordKeyJson)[0]!;
    const keyVal = recordKeyJson[keyCol];

    let original: Record<string, unknown> | null = null;
    try {
      original = await this.sourceRepo.getByColumn(dataSourceId, keyCol, String(keyVal));
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e;
    }

    const changes = await loadChangesForDataSource(ds);
    const recordKey = recordKeyToString(recordKeyJson);
    const relevant = changes.filter((c) => c.recordKey === recordKey);
    const merged = applyChangesToRow(original, relevant);
    if (!merged || merged.meta.isDeletedLocally) {
      throw new NotFoundError('Registro não encontrado ou excluído localmente');
    }
    return attachGabiMeta(merged);
  }

  async create(
    ds: DataSource,
    body: Record<string, unknown>,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    const keyCol = this.getKeyColumn(ds);
    const payload = { ...body };
    if (payload[keyCol] === undefined) {
      payload[keyCol] = randomUUID();
    }

    await appendOdkChange({
      ds,
      operation: 'CREATE',
      payload,
      userId,
    });

    const merged = applyChangesToRow(null, [
      {
        id: '',
        connectionId: ds.connectionId,
        schema: ds.schema,
        table: ds.table,
        recordKey: recordKeyToString(buildRecordKeyJson(payload, keyCol)),
        recordKeyJson: buildRecordKeyJson(payload, keyCol),
        operation: 'CREATE',
        payload,
        createdAt: new Date().toISOString(),
      },
    ]);
    return attachGabiMeta(merged!);
  }

  async update(
    ds: DataSource,
    dataSourceId: string,
    recordId: string,
    patch: Record<string, unknown>,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    const recordKeyJson = resolveRecordKeyFromId(ds, recordId);

    await appendOdkChange({
      ds,
      operation: 'UPDATE',
      recordKeyJson,
      payload: patch,
      userId,
    });

    return this.getById(ds, dataSourceId, recordId);
  }

  async remove(ds: DataSource, recordId: string, userId?: string): Promise<void> {
    const recordKeyJson = resolveRecordKeyFromId(ds, recordId);
    await appendOdkChange({
      ds,
      operation: 'DELETE',
      recordKeyJson,
      payload: {},
      userId,
    });
  }

  async listGeoJson(ds: DataSource, dataSourceId: string, params: ListQuery) {
    const list = await this.list(ds, dataSourceId, {
      ...params,
      pageSize: Math.min(params.pageSize ?? 500, 500),
    });

    const features = list.data
      .map((row) => {
        const meta = row._gabi as { isDeletedLocally?: boolean } | undefined;
        if (meta?.isDeletedLocally) return null;

        let geometry: unknown = null;
        if (ds.geometryColumn && row[ds.geometryColumn]) {
          geometry =
            typeof row[ds.geometryColumn] === 'string'
              ? JSON.parse(row[ds.geometryColumn] as string)
              : row[ds.geometryColumn];
        } else if (ds.latitudeColumn && ds.longitudeColumn) {
          const lat = Number(row[ds.latitudeColumn]);
          const lon = Number(row[ds.longitudeColumn]);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            geometry = { type: 'Point', coordinates: [lon, lat] };
          }
        }
        if (!geometry) return null;

        const properties = { ...row };
        if (ds.geometryColumn) delete properties[ds.geometryColumn];

        return { type: 'Feature' as const, geometry, properties };
      })
      .filter(Boolean);

    return { type: 'FeatureCollection' as const, features };
  }
}

export function isOdkOverlayDataSource(ds: DataSource): boolean {
  return Boolean(ds.odkReadOnly);
}

export function inferOdkDataSourceFlags(
  table: { columns: { name: string }[]; primaryKey: string[] },
  odkDetected: boolean,
): { odkReadOnly: boolean; recordKeyColumn?: string } {
  if (!odkDetected) return { odkReadOnly: false };
  try {
    const recordKeyColumn = resolveRecordKeyColumn(
      table as Parameters<typeof resolveRecordKeyColumn>[0],
    );
    return { odkReadOnly: true, recordKeyColumn };
  } catch {
    return { odkReadOnly: true, recordKeyColumn: '_uuid' };
  }
}
