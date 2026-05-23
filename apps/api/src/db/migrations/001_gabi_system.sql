-- GABI system tables
CREATE TABLE IF NOT EXISTS gabi_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gabi_role (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gabi_permission (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  condition JSONB,
  UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS gabi_role_permission (
  role_id TEXT NOT NULL REFERENCES gabi_role(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES gabi_permission(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS gabi_user_role (
  user_id TEXT NOT NULL REFERENCES gabi_user(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES gabi_role(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS gabi_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES gabi_user(id),
  ip TEXT,
  user_agent TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gabi_data_source (
  id TEXT PRIMARY KEY,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  label TEXT NOT NULL,
  geometry_column TEXT,
  latitude_column TEXT,
  longitude_column TEXT,
  columns_meta JSONB NOT NULL DEFAULT '[]',
  primary_key JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schema_name, table_name)
);

CREATE TABLE IF NOT EXISTS gabi_page (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data_source_id TEXT NOT NULL REFERENCES gabi_data_source(id) ON DELETE CASCADE,
  resource TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gabi_audit_created ON gabi_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gabi_page_resource ON gabi_page(resource);
