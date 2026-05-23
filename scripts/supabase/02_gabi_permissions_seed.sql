-- =============================================================================
-- GABI — Papéis e permissões base (banco META Supabase)
-- =============================================================================
-- O usuário admin da aplicação é criado por: pnpm db:seed (bcrypt na API)
-- Este script só cria role admin + permissões globais.
-- =============================================================================

INSERT INTO gabi_role (id, name)
VALUES ('role_admin', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Permissões
INSERT INTO gabi_permission (id, resource, action) VALUES
  ('perm_manage_all', '*', 'manage'),
  ('perm_system_read', 'system', 'read'),
  ('perm_system_manage', 'system', 'manage'),
  ('perm_connections_read', 'connections', 'read'),
  ('perm_connections_manage', 'connections', 'manage')
ON CONFLICT (resource, action) DO NOTHING;

-- Vincular ao role admin
INSERT INTO gabi_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM gabi_role r
CROSS JOIN gabi_permission p
WHERE r.name = 'admin'
  AND p.resource IN ('*', 'system', 'connections')
ON CONFLICT DO NOTHING;

INSERT INTO gabi_migration (name) VALUES ('supabase_02_gabi_permissions_seed')
ON CONFLICT (name) DO NOTHING;
