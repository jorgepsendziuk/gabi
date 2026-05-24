-- Escopo de páginas: private (só o dono) ou global (todos os usuários autenticados)
ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('private', 'global'));

ALTER TABLE gabi_page
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES gabi_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gabi_page_scope_owner ON gabi_page(scope, owner_user_id);

COMMENT ON COLUMN gabi_page.scope IS 'private = visível só ao owner_user_id; global = todos os usuários autenticados';
COMMENT ON COLUMN gabi_page.owner_user_id IS 'Dono da página quando scope = private';
