export type PageType = 'list' | 'map' | 'form' | 'detail' | 'dashboard' | 'report';

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

export interface TableMeta {
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: ColumnMeta[];
  primaryKey: string[];
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
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
  columns: ColumnMeta[];
  primaryKey: string[];
  /** ODK / fonte externa somente leitura — mutações vão para gabi_odk_change */
  odkReadOnly?: boolean;
  recordKeyColumn?: string;
  enabled: boolean;
  createdAt: string;
}

export interface Page {
  id: string;
  type: PageType;
  connectionId: string;
  dataSourceId: string;
  resource: string;
  label: string;
  config: Record<string, unknown>;
  createdAt: string;
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

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string>;
  bbox?: [number, number, number, number];
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
