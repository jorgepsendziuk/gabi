-- Usuário dedicado da API Node (pooler Supabase). Senha definida no primeiro deploy;
-- depois use ALTER ROLE ou recrie via configure-api-env.sh.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gabi_api') THEN
    RAISE NOTICE 'Role gabi_api: crie com configure-api-env.sh ou migration manual';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO gabi_api;
-- DDL de migrations roda via supabase db query --linked (superuser), não pela API.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gabi_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gabi_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gabi_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gabi_api;
ALTER ROLE gabi_api BYPASSRLS;

INSERT INTO gabi_migration (name) VALUES ('supabase_06_gabi_api_role')
ON CONFLICT (name) DO NOTHING;
