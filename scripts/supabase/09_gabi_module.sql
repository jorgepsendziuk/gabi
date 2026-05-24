-- Módulos GABI (agrupamento de páginas)
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

CREATE INDEX IF NOT EXISTS idx_gabi_module_enabled ON gabi_module(enabled, sort_order);

ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES gabi_module(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gabi_page_module ON gabi_page(module_id);

INSERT INTO gabi_module (id, name, slug, description, sort_order)
VALUES ('mod_default', 'Geral', 'geral', 'Páginas gerais do sistema', 0)
ON CONFLICT (id) DO NOTHING;

UPDATE gabi_page SET module_id = 'mod_default' WHERE module_id IS NULL;

INSERT INTO gabi_migration (name) VALUES ('supabase_09_gabi_module')
ON CONFLICT (name) DO NOTHING;
