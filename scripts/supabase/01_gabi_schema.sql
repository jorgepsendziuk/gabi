-- =============================================================================
-- GABI — Schema completo no Supabase (banco META)
-- =============================================================================
-- Execute no SQL Editor do Supabase do projeto que guardará:
--   usuários, conexões, páginas geradas, auditoria e gabi_odk_change (overlay)
--
-- O banco ODK fica em OUTRO Postgres (somente leitura). Não misture os dois papéis.
-- =============================================================================

-- Controle de migrations (compatível com pnpm db:migrate local)
CREATE TABLE IF NOT EXISTS gabi_migration (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Sistema: auth, RBAC, auditoria
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gabi_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_gabi_audit_created ON gabi_audit_log(created_at DESC);

-- -----------------------------------------------------------------------------
-- Conexões multi-banco
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gabi_connection (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL,
  db_user TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  ssl BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_odk_source BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_introspected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gabi_connection_enabled ON gabi_connection(enabled);

COMMENT ON TABLE gabi_connection IS 'Cadastro de Postgres externos (ODK, ERP). Senha criptografada pela API GABI.';
COMMENT ON COLUMN gabi_connection.is_odk_source IS 'true = leitura no ODK + alterações em gabi_odk_change';

-- -----------------------------------------------------------------------------
-- Metamodelo: fontes de dados e páginas geradas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gabi_data_source (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES gabi_connection(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  label TEXT NOT NULL,
  geometry_column TEXT,
  latitude_column TEXT,
  longitude_column TEXT,
  columns_meta JSONB NOT NULL DEFAULT '[]',
  primary_key JSONB NOT NULL DEFAULT '[]',
  odk_read_only BOOLEAN NOT NULL DEFAULT FALSE,
  record_key_column TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, schema_name, table_name)
);

CREATE TABLE IF NOT EXISTS gabi_module (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gabi_page (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES gabi_connection(id) ON DELETE CASCADE,
  data_source_id TEXT NOT NULL REFERENCES gabi_data_source(id) ON DELETE CASCADE,
  module_id TEXT REFERENCES gabi_module(id) ON DELETE SET NULL,
  resource TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('private', 'global')),
  owner_user_id TEXT REFERENCES gabi_user(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO gabi_module (id, name, slug, description, sort_order)
VALUES ('mod_default', 'Geral', 'geral', 'Páginas gerais do sistema', 0)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_gabi_page_resource ON gabi_page(resource);
CREATE INDEX IF NOT EXISTS idx_gabi_page_module ON gabi_page(module_id);
CREATE INDEX IF NOT EXISTS idx_gabi_data_source_connection ON gabi_data_source(connection_id);

COMMENT ON COLUMN gabi_data_source.odk_read_only IS
  'Fonte ODK: SELECT no banco externo; writes apenas em gabi_odk_change';

-- -----------------------------------------------------------------------------
-- Overlay ODK (alterações locais — NUNCA gravam no Postgres ODK)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gabi_odk_change (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES gabi_connection(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_key TEXT NOT NULL,
  record_key_json JSONB NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
  payload JSONB NOT NULL DEFAULT '{}',
  user_id TEXT REFERENCES gabi_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odk_change_lookup
  ON gabi_odk_change (connection_id, schema_name, table_name, record_key);

CREATE INDEX IF NOT EXISTS idx_odk_change_table
  ON gabi_odk_change (connection_id, schema_name, table_name, created_at DESC);

-- -----------------------------------------------------------------------------
-- RLS (opcional no Supabase — desabilitado por padrão; API usa service role)
-- -----------------------------------------------------------------------------
-- O GABI hoje acessa via connection string direta (apps/api/.env).
-- Se quiser expor tabelas via PostgREST no futuro, habilite RLS por tabela.

ALTER TABLE gabi_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE gabi_odk_change ENABLE ROW LEVEL SECURITY;
-- Políticas customizadas devem ser criadas conforme seu modelo de auth Supabase.

-- Registrar migration
INSERT INTO gabi_migration (name) VALUES ('supabase_01_gabi_schema')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Próximo passo: executar 02_gabi_permissions_seed.sql (papéis base)
-- Depois: pnpm db:seed na API OU cadastrar admin manualmente
-- =============================================================================
