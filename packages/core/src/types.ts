export type PageType = 'list' | 'map' | 'form' | 'detail' | 'dashboard' | 'report';

/** private = só o dono; global = qualquer usuário autenticado */
export type PageScope = 'private' | 'global';

export type PermissionAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'manage';

export interface ColumnMeta {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  isGeometry: boolean;
  isLatitude: boolean;
  isLongitude: boolean;
}

/** Formato das coordenadas na tabela (PostGIS, par lat/lon, ODK geopoint, etc.). */
export type GeoSourceType = 'postgis' | 'latlon' | 'geopoint' | 'geolocation';

export interface TableMeta {
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: ColumnMeta[];
  primaryKey: string[];
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  geoSource?: GeoSourceType;
}

export interface ForeignKeyMeta {
  schema: string;
  table: string;
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IntrospectionResult {
  tables: TableMeta[];
  foreignKeys: ForeignKeyMeta[];
  scannedAt: string;
}

export interface DbConnection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  isDefault: boolean;
  /** Postgres ODK de origem — leitura externa + overlay no meta */
  isOdkSource?: boolean;
  enabled: boolean;
  lastIntrospectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OdkChangeOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface OdkChange {
  id: string;
  connectionId: string;
  schema: string;
  table: string;
  recordKey: string;
  recordKeyJson: Record<string, unknown>;
  operation: OdkChangeOperation;
  payload: Record<string, unknown>;
  userId?: string;
  createdAt: string;
}

/** Metadados de overlay anexados a cada registro exibido */
export interface GabiRecordMeta {
  odkOverlay: boolean;
  hasLocalChanges: boolean;
  operation?: OdkChangeOperation;
  isCreatedLocally: boolean;
  isDeletedLocally: boolean;
  original?: Record<string, unknown>;
}

export interface DataSource {
  id: string;
  connectionId: string;
  schema: string;
  table: string;
  label: string;
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  geoSource?: GeoSourceType;
  columns: ColumnMeta[];
  primaryKey: string[];
  /** ODK / fonte externa somente leitura — mutações vão para gabi_odk_change */
  odkReadOnly?: boolean;
  recordKeyColumn?: string;
  enabled: boolean;
  createdAt: string;
}

export interface GabiModule {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  type: PageType;
  connectionId: string;
  dataSourceId: string;
  moduleId?: string;
  resource: string;
  label: string;
  scope: PageScope;
  ownerUserId?: string;
  config: Record<string, unknown>;
  createdAt: string;
}

/** Página com metadados da conexão e tabela (listagem admin). */
export interface PageListItem extends Page {
  schema: string;
  table: string;
  connectionName: string;
  moduleName?: string;
  geometryColumn?: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  condition?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  roles: Role[];
}

export interface ListColumnConfig {
  field: string;
  header: string;
  visible: boolean;
}

export interface ListFilterConfig {
  field: string;
  label: string;
  visible: boolean;
}

/** Configuração de página tipo lista (em `Page.config`). */
export interface ListPageConfig {
  columns: ListColumnConfig[];
  filters: ListFilterConfig[];
  geometryColumn?: string;
}

export type DashboardWidgetType = 'kpi' | 'text' | 'table' | 'chart';

export interface DashboardWidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  config: Record<string, unknown>;
}

/** Configuração de página tipo dashboard (em `Page.config`). */
export interface DashboardPageConfig {
  layout: DashboardWidgetLayout[];
  widgets: DashboardWidget[];
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string>;
  bbox?: [number, number, number, number];
  /** Colunas a exportar (nomes dos campos). */
  columns?: string[];
}

export interface ListResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditEntry {
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}
