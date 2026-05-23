-- Overlay ODK: origem somente leitura; alterações no banco meta GABI

ALTER TABLE gabi_connection
  ADD COLUMN IF NOT EXISTS is_odk_source BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE gabi_data_source
  ADD COLUMN IF NOT EXISTS odk_read_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS record_key_column TEXT;

COMMENT ON COLUMN gabi_data_source.odk_read_only IS
  'Quando true, SELECT na conexão externa e mutações em gabi_odk_change';

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
