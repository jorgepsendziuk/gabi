-- Admin inicial GABI (senha: admin123 — troque em produção)
INSERT INTO gabi_user (id, email, password_hash, name)
VALUES (
  'user_admin',
  'admin@gabi.local',
  '$2a$10$UuWuRimb/JG7Y/v6a6FQsOL6SVgaFvkTvnua1UUcfLeBXfgXHYOR.',
  'Administrador'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO gabi_user_role (user_id, role_id)
SELECT u.id, r.id
FROM gabi_user u, gabi_role r
WHERE u.email = 'admin@gabi.local' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO gabi_migration (name) VALUES ('supabase_03_seed_admin')
ON CONFLICT (name) DO NOTHING;
