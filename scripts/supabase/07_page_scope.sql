-- Escopo de páginas (private / global)
ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('private', 'global'));

ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES gabi_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gabi_page_scope_owner ON gabi_page(scope, owner_user_id);

INSERT INTO gabi_migration (name) VALUES ('supabase_07_page_scope')
ON CONFLICT (name) DO NOTHING;
