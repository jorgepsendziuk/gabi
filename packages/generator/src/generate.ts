import type { DataSource, Page, PageType, PermissionAction, TableMeta } from '@gabi/core';
import { hasGeoCapability } from '@gabi/introspector';
import { toDataSourceId } from '@gabi/introspector';
import { randomUUID } from 'node:crypto';

export interface GeneratePageInput {
  connectionId: string;
  table: TableMeta;
  type: PageType;
  label?: string;
  odkReadOnly?: boolean;
  recordKeyColumn?: string;
}

export interface GeneratePageResult {
  dataSource: DataSource;
  page: Page;
  permissions: Array<{ resource: string; action: PermissionAction }>;
}

export function tableToDataSource(
  connectionId: string,
  table: TableMeta,
  flags?: { odkReadOnly?: boolean; recordKeyColumn?: string },
): DataSource {
  return tableToDataSourceWithFlags(connectionId, table, flags);
}

export function tableToDataSourceWithFlags(
  connectionId: string,
  table: TableMeta,
  flags?: { odkReadOnly?: boolean; recordKeyColumn?: string },
): DataSource {
  const id = toDataSourceId(connectionId, table.schema, table.name);
  return {
    id,
    connectionId,
    schema: table.schema,
    table: table.name,
    label: table.name,
    geometryColumn: table.geometryColumn,
    latitudeColumn: table.latitudeColumn,
    longitudeColumn: table.longitudeColumn,
    columns: table.columns,
    primaryKey: table.primaryKey,
    odkReadOnly: flags?.odkReadOnly,
    recordKeyColumn: flags?.recordKeyColumn,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
}

export function generatePage(input: GeneratePageInput): GeneratePageResult {
  const dataSource = tableToDataSourceWithFlags(input.connectionId, input.table, {
    odkReadOnly: input.odkReadOnly,
    recordKeyColumn: input.recordKeyColumn,
  });
  const resource = `${dataSource.id.replace(/\./g, '_')}_${input.type}`;
  const label = input.label ?? `${input.table.schema}.${input.table.name}`;

  if (input.type === 'map' && !hasGeoCapability(input.table)) {
    throw new Error('Tabela sem suporte geoespacial para página de mapa');
  }

  const page: Page = {
    id: randomUUID(),
    type: input.type,
    connectionId: input.connectionId,
    dataSourceId: dataSource.id,
    resource,
    label: input.type === 'map' ? `Mapa: ${label}` : `Lista: ${label}`,
    config: {
      columns: input.table.columns
        .filter((c) => !c.isGeometry)
        .slice(0, 12)
        .map((c) => ({ field: c.name, header: c.name })),
      geometryColumn: input.table.geometryColumn,
    },
    createdAt: new Date().toISOString(),
  };

  const permissions: Array<{ resource: string; action: PermissionAction }> = [
    { resource, action: 'read' },
    { resource, action: 'export' },
  ];

  if (input.type === 'list') {
    permissions.push(
      { resource, action: 'create' },
      { resource, action: 'update' },
      { resource, action: 'delete' },
    );
  }

  return { dataSource, page, permissions };
}

export function suggestPageTypes(table: TableMeta): PageType[] {
  const types: PageType[] = ['list'];
  if (hasGeoCapability(table)) types.push('map');
  return types;
}
