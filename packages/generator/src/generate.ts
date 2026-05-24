import type {
  DashboardPageConfig,
  DataSource,
  ListColumnConfig,
  ListFilterConfig,
  ListPageConfig,
  Page,
  PageScope,
  PageType,
  PermissionAction,
  TableMeta,
} from '@gabi/core';
import { buildDefaultDashboardPageConfig } from '@gabi/core';
import { hasGeoCapability } from '@gabi/introspector';
import { toDataSourceId } from '@gabi/introspector';
import { randomUUID } from 'node:crypto';

export interface GeneratePageInput {
  connectionId: string;
  table: TableMeta;
  type: PageType;
  label?: string;
  moduleId?: string;
  scope?: PageScope;
  ownerUserId?: string;
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
    geoSource: table.geoSource,
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

  const listConfig =
    input.type === 'list' ? buildDefaultListPageConfig(input.table) : null;

  const pageLabel =
    input.type === 'map'
      ? `Mapa: ${label}`
      : input.type === 'report'
        ? `Relatório: ${label}`
        : input.type === 'dashboard'
          ? `Dashboard: ${label}`
          : `Lista: ${label}`;

  const scope = input.scope ?? 'global';

  const page: Page = {
    id: randomUUID(),
    type: input.type,
    connectionId: input.connectionId,
    dataSourceId: dataSource.id,
    moduleId: input.moduleId,
    resource,
    label: pageLabel,
    scope,
    ownerUserId: scope === 'private' ? input.ownerUserId : undefined,
    config:
      input.type === 'dashboard'
        ? (buildDefaultDashboardPageConfig() as unknown as Record<string, unknown>)
        : {
            ...(listConfig ?? {
              columns: input.table.columns
                .filter((c) => !c.isGeometry)
                .slice(0, 12)
                .map((c) => ({ field: c.name, header: c.name })),
            }),
            geometryColumn: input.table.geometryColumn,
            ...(input.type === 'report'
              ? {
                  bodyHtml: defaultReportBodyHtml(label),
                  showDataTable: true,
                }
              : {}),
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

/** Colunas e filtros para todos os campos não-geometria da tabela. */
export function buildDefaultListPageConfig(table: TableMeta): ListPageConfig {
  const fields = table.columns.filter((c) => !c.isGeometry);
  const columns: ListColumnConfig[] = fields.map((c, i) => ({
    field: c.name,
    header: c.name,
    visible: i < 12,
  }));
  const filters: ListFilterConfig[] = fields.map((c) => ({
    field: c.name,
    label: c.name,
    visible: true,
  }));
  return {
    columns,
    filters,
    geometryColumn: table.geometryColumn,
  };
}

export function defaultReportBodyHtml(tableLabel: string): string {
  const safe = tableLabel.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<h1>Relatório: ${safe}</h1><p><em>Emitido em {{__date__}}</em></p><p>Personalize este conteúdo no editor. Use <code>{{nome_da_coluna}}</code> para campos do primeiro registro.</p><p>A tabela de dados aparece na visualização quando a opção estiver ativa.</p>`;
}

export function suggestPageTypes(table: TableMeta): PageType[] {
  const types: PageType[] = ['list', 'report', 'dashboard'];
  if (hasGeoCapability(table)) types.push('map');
  return types;
}

export function buildDashboardPageConfig(): DashboardPageConfig {
  return buildDefaultDashboardPageConfig();
}
