import type { DataSource, ListQuery, ListResult } from '@gabi/core';
import { geometryFromRow } from '@gabi/introspector';
import { NotFoundError } from '@gabi/core';
import { query } from '@gabi/db';
import type pg from 'pg';
import { z } from 'zod';
import { rowsToCsv } from './csv.js';

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdentifier(name: string, label: string): void {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Identificador inválido: ${label}`);
  }
}

function qualifiedTable(ds: DataSource): string {
  assertIdentifier(ds.schema, 'schema');
  assertIdentifier(ds.table, 'table');
  return `"${ds.schema}"."${ds.table}"`;
}

function geoAsGeoJSON(col: string): string {
  assertIdentifier(col, 'geometryColumn');
  return `ST_AsGeoJSON("${col}")::json AS "${col}"`;
}

export class DynamicRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly dataSources: Map<string, DataSource>,
  ) {}

  getDataSource(id: string): DataSource {
    const ds = this.dataSources.get(id);
    if (!ds || !ds.enabled) {
      throw new NotFoundError(`DataSource não encontrada: ${id}`);
    }
    return ds;
  }

  async list(dataSourceId: string, params: ListQuery): Promise<ListResult> {
    const ds = this.getDataSource(dataSourceId);
    const page = Math.max(1, params.page ?? 1);
    const rawSize = Math.max(1, params.pageSize ?? 25);
    // Listagens via API ficam em até 100; geojson/export chamam list() com pageSize maior.
    const pageSize = rawSize <= 100 ? rawSize : Math.min(rawSize, 5000);
    const offset = (page - 1) * pageSize;

    const selectCols = this.buildSelectColumns(ds);
    const table = qualifiedTable(ds);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.search) {
      const textCols = ds.columns
        .filter((c) => ['text', 'character varying', 'varchar', 'char'].includes(c.dataType))
        .slice(0, 5);
      if (textCols.length > 0) {
        const searchParts = textCols.map((c) => {
          assertIdentifier(c.name, 'column');
          return `"${c.name}"::text ILIKE $${paramIndex}`;
        });
        values.push(`%${params.search}%`);
        conditions.push(`(${searchParts.join(' OR ')})`);
        paramIndex++;
      }
    }

    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        const col = ds.columns.find((c) => c.name === key);
        if (!col || col.isGeometry) continue;
        assertIdentifier(key, 'filter');
        conditions.push(`"${key}"::text = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (params.bbox && ds.geometryColumn) {
      assertIdentifier(ds.geometryColumn, 'geometryColumn');
      const [minX, minY, maxX, maxY] = params.bbox;
      conditions.push(
        `ST_Intersects("${ds.geometryColumn}", ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326))`,
      );
      values.push(minX, minY, maxX, maxY);
      paramIndex += 4;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = '';
    if (params.sort) {
      const col = ds.columns.find((c) => c.name === params.sort);
      if (col && !col.isGeometry) {
        assertIdentifier(params.sort, 'sort');
        const dir = params.order === 'desc' ? 'DESC' : 'ASC';
        orderClause = `ORDER BY "${params.sort}" ${dir}`;
      }
    } else if (ds.primaryKey.length > 0) {
      orderClause = `ORDER BY ${ds.primaryKey.map((k) => `"${k}"`).join(', ')}`;
    }

    const countSql = `SELECT COUNT(*)::int AS total FROM ${table} ${where}`;
    const countResult = await query<{ total: number }>(this.pool, countSql, values);
    const total = countResult[0]?.total ?? 0;

    const dataSql = `
      SELECT ${selectCols}
      FROM ${table}
      ${where}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataValues = [...values, pageSize, offset];
    const data = await query<Record<string, unknown>>(this.pool, dataSql, dataValues);

    return { data, total, page, pageSize };
  }

  async getById(dataSourceId: string, id: string): Promise<Record<string, unknown>> {
    const ds = this.getDataSource(dataSourceId);
    const keyCol = ds.recordKeyColumn ?? ds.primaryKey[0];
    if (!keyCol) throw new Error('Chave de registro não definida');
    return this.getByColumn(dataSourceId, keyCol, id);
  }

  async getByColumn(
    dataSourceId: string,
    column: string,
    value: string,
  ): Promise<Record<string, unknown>> {
    const ds = this.getDataSource(dataSourceId);
    assertIdentifier(column, 'column');
    const selectCols = this.buildSelectColumns(ds);
    const table = qualifiedTable(ds);
    const rows = await query<Record<string, unknown>>(
      this.pool,
      `SELECT ${selectCols} FROM ${table} WHERE "${column}" = $1 LIMIT 1`,
      [value],
    );
    if (!rows[0]) throw new NotFoundError('Registro não encontrado');
    return rows[0];
  }

  async listGeoJson(dataSourceId: string, params: ListQuery): Promise<{
    type: 'FeatureCollection';
    features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
  }> {
    const ds = this.getDataSource(dataSourceId);
    const cap = Math.min(params.pageSize ?? 500, 5000);
    const result = await this.list(dataSourceId, { ...params, page: 1, pageSize: cap });

    const features = result.data
      .map((row) => {
        const geometry = geometryFromRow(row, {
          geometryColumn: ds.geometryColumn,
          latitudeColumn: ds.latitudeColumn,
          longitudeColumn: ds.longitudeColumn,
          geoSource: ds.geoSource,
        });
        if (!geometry) return null;

        const properties = { ...row };
        if (ds.geometryColumn) delete properties[ds.geometryColumn];
        if (ds.latitudeColumn) delete properties[ds.latitudeColumn];
        if (ds.longitudeColumn) delete properties[ds.longitudeColumn];

        return { type: 'Feature' as const, geometry, properties };
      })
      .filter(Boolean) as Array<{
      type: 'Feature';
      geometry: unknown;
      properties: Record<string, unknown>;
    }>;

    return { type: 'FeatureCollection', features };
  }

  async exportCsv(dataSourceId: string, params: ListQuery): Promise<string> {
    const result = await this.list(dataSourceId, { ...params, page: 1, pageSize: 10000 });
    const ds = this.getDataSource(dataSourceId);
    const allowed = new Set(ds.columns.filter((c) => !c.isGeometry).map((c) => c.name));
    const cols =
      params.columns?.filter((c) => allowed.has(c)) ??
      ds.columns.filter((c) => !c.isGeometry).map((c) => c.name);
    return rowsToCsv(cols, result.data, cols);
  }

  private buildSelectColumns(ds: DataSource): string {
    return ds.columns
      .map((c) => {
        assertIdentifier(c.name, 'column');
        if (c.isGeometry && ds.geometryColumn === c.name) {
          return geoAsGeoJSON(c.name);
        }
        return `"${c.name}"`;
      })
      .join(', ');
  }
}

function parseFiltersInput(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null || raw === '') continue;
    out[key] = String(raw);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseColumnsInput(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const cols = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cols.length > 0 ? cols : undefined;
}

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  filters: z.preprocess(parseFiltersInput, z.record(z.string()).optional()),
  columns: z.preprocess(parseColumnsInput, z.array(z.string()).optional()),
  bbox: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const parts = v.split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) return undefined;
      return parts as [number, number, number, number];
    }),
});

/** Mapas podem carregar mais feições que listagens paginadas. */
export const geojsonQuerySchema = listQuerySchema.extend({
  pageSize: z.coerce.number().int().positive().max(5000).optional(),
});
