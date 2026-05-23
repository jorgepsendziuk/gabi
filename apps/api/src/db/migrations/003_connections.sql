-- Registro de conexões PostgreSQL (multi-banco por projeto GABI)
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
  ssl BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_introspected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gabi_connection_enabled ON gabi_connection(enabled);

-- Vincula fontes de dados e páginas à conexão de origem
ALTER TABLE gabi_data_source
  ADD COLUMN IF NOT EXISTS connection_id TEXT REFERENCES gabi_connection(id) ON DELETE CASCADE;

ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS connection_id TEXT REFERENCES gabi_connection(id) ON DELETE CASCADE;

-- Remove unique global schema+table; passa a ser por conexão
ALTER TABLE gabi_data_source DROP CONSTRAINT IF EXISTS gabi_data_source_schema_name_table_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS gabi_data_source_conn_schema_table
  ON gabi_data_source (connection_id, schema_name, table_name);

-- Conexão padrão (detalhes preenchidos pelo seed em apps/api/src/db/seed-connections.ts)
INSERT INTO gabi_connection (
  id, name, slug, description,
  host, port, database_name, db_user, password_enc, ssl, is_default
)
SELECT
  'conn_default',
  'Banco local (padrão)',
  'default',
  'Mesmo banco definido em apps/api/.env — metadados GABI + dados demo',
  'localhost',
  5432,
  'gabi',
  'gabi',
  'env',
  FALSE,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM gabi_connection WHERE slug = 'default');

-- Atualiza registros existentes para a conexão padrão
UPDATE gabi_data_source SET connection_id = 'conn_default' WHERE connection_id IS NULL;
UPDATE gabi_page SET connection_id = 'conn_default' WHERE connection_id IS NULL;

ALTER TABLE gabi_data_source ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE gabi_page ALTER COLUMN connection_id SET NOT NULL;
