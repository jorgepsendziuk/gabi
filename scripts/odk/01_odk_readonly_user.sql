-- =============================================================================
-- PostgreSQL ODK — usuário SOMENTE LEITURA para o GABI
-- =============================================================================
-- Execute conectado como superuser (postgres) no banco onde está o ODK.
-- Ajuste as variáveis na seção CONFIG abaixo antes de rodar.
--
-- O GABI:
--   • faz SELECT nas tabelas ODK (dados originais)
--   • grava CREATE/UPDATE/DELETE em gabi_odk_change no Supabase (meta)
--   • NUNCA deve receber permissão de escrita neste banco ODK
-- =============================================================================

-- ############################ CONFIG — EDITE AQUI ############################

-- \set odk_db_name     'odk_producao'
-- \set odk_user        'gabi_odk_readonly'
-- \set odk_password    'TROQUE_POR_SENHA_FORTE'

-- Para psql, descomente e use \set, OU substitua manualmente abaixo:

-- Nome do banco ODK:
--   odk_producao
-- Usuário novo:
--   gabi_odk_readonly
-- Senha:
--   (defina no CREATE USER)

-- Schemas com tabelas ODK (ajuste se usar outro schema):
--   public
--   odk
--   aggregate

-- #############################################################################

-- -----------------------------------------------------------------------------
-- 1. Criar role (usuário de login)
-- -----------------------------------------------------------------------------
-- Substitua a senha antes de executar:

CREATE ROLE gabi_odk_readonly WITH
  LOGIN
  PASSWORD 'TROQUE_POR_SENHA_FORTE'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  CONNECTION LIMIT 20;

COMMENT ON ROLE gabi_odk_readonly IS 'GABI framework — somente leitura em tabelas ODK';

-- -----------------------------------------------------------------------------
-- 2. Conectar no banco ODK
-- -----------------------------------------------------------------------------
-- No psql: \c odk_producao
-- Ou rode o bloco abaixo após conectar manualmente no database correto.

-- GRANT CONNECT ON DATABASE odk_producao TO gabi_odk_readonly;

-- -----------------------------------------------------------------------------
-- 3. Schemas — USAGE (necessário para ver tabelas)
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO gabi_odk_readonly;

-- Descomente se suas tabelas ODK estiverem em outros schemas:
-- GRANT USAGE ON SCHEMA odk TO gabi_odk_readonly;
-- GRANT USAGE ON SCHEMA aggregate TO gabi_odk_readonly;

-- -----------------------------------------------------------------------------
-- 4. SELECT em tabelas e views existentes
-- -----------------------------------------------------------------------------

GRANT SELECT ON ALL TABLES IN SCHEMA public TO gabi_odk_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO gabi_odk_readonly;

-- GRANT SELECT ON ALL TABLES IN SCHEMA odk TO gabi_odk_readonly;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA odk TO gabi_odk_readonly;

-- -----------------------------------------------------------------------------
-- 5. Tabelas criadas no futuro (ODK Aggregate costuma criar novas)
-- -----------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO gabi_odk_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO gabi_odk_readonly;

-- ALTER DEFAULT PRIVILEGES IN SCHEMA odk
--   GRANT SELECT ON TABLES TO gabi_odk_readonly;

-- -----------------------------------------------------------------------------
-- 6. PostGIS (leitura de metadados espaciais + geometrias)
-- -----------------------------------------------------------------------------

GRANT SELECT ON geometry_columns TO gabi_odk_readonly;
GRANT SELECT ON geography_columns TO gabi_odk_readonly;

-- Funções PostGIS usadas em introspection (ST_AsGeoJSON, ST_Intersects, etc.)
-- são executadas no servidor com os privilégios do OWNER da tabela, não do reader.
-- SELECT nas colunas geometry/geography já basta para o GABI listar/mapa.

-- Se o schema postgis existir como extensão em schema dedicado:
-- GRANT USAGE ON SCHEMA postgis TO gabi_odk_readonly;

-- -----------------------------------------------------------------------------
-- 7. Garantir que NÃO há escrita (explícito — revogar se existir)
-- -----------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM gabi_odk_readonly;

-- REVOKE ALL ON SCHEMA public FROM gabi_odk_readonly;  -- não use — remove USAGE

-- -----------------------------------------------------------------------------
-- 8. Teste rápido (rode como gabi_odk_readonly)
-- -----------------------------------------------------------------------------
-- SET ROLE gabi_odk_readonly;
-- SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM sua_tabela_odk LIMIT 1;
-- RESET ROLE;

-- -----------------------------------------------------------------------------
-- 9. Cadastro no GABI (Admin → Conexões)
-- -----------------------------------------------------------------------------
-- Host:     (host do Postgres ODK)
-- Port:     5432
-- Database: odk_producao
-- User:     gabi_odk_readonly
-- Password: (a mesma do CREATE ROLE)
-- SSL:      true (se produção)
-- [x] Fonte ODK (somente leitura + overlay GABI)
