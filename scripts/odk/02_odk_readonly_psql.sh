#!/usr/bin/env bash
# =============================================================================
# Cria usuário somente leitura no Postgres ODK via psql
# Uso:
#   export PGHOST=seu-host
#   export PGPORT=5432
#   export PGUSER=postgres
#   export PGPASSWORD=...
#   export ODK_DB=odk_producao
#   export ODK_READONLY_USER=gabi_odk_readonly
#   export ODK_READONLY_PASSWORD='senha-forte'
#   export ODK_SCHEMAS='public'   # ou 'public,odk'
#   ./scripts/odk/02_odk_readonly_psql.sh
# =============================================================================

set -euo pipefail

: "${ODK_DB:?Defina ODK_DB}"
: "${ODK_READONLY_USER:?Defina ODK_READONLY_USER}"
: "${ODK_READONLY_PASSWORD:?Defina ODK_READONLY_PASSWORD}"
: "${ODK_SCHEMAS:=public}"

IFS=',' read -ra SCHEMAS <<< "$ODK_SCHEMAS"

echo "→ Criando role ${ODK_READONLY_USER}..."
psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ODK_READONLY_USER}') THEN
    CREATE ROLE ${ODK_READONLY_USER} LOGIN PASSWORD '${ODK_READONLY_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
  ELSE
    ALTER ROLE ${ODK_READONLY_USER} PASSWORD '${ODK_READONLY_PASSWORD}';
  END IF;
END
\$\$;
SQL

echo "→ Grants no banco ${ODK_DB}..."
psql -v ON_ERROR_STOP=1 -d "$ODK_DB" <<SQL
GRANT CONNECT ON DATABASE ${ODK_DB} TO ${ODK_READONLY_USER};
SQL

for schema in "${SCHEMAS[@]}"; do
  schema=$(echo "$schema" | xargs)
  echo "→ Schema: ${schema}"
  psql -v ON_ERROR_STOP=1 -d "$ODK_DB" <<SQL
GRANT USAGE ON SCHEMA ${schema} TO ${ODK_READONLY_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${ODK_READONLY_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${ODK_READONLY_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${ODK_READONLY_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON SEQUENCES TO ${ODK_READONLY_USER};
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA ${schema} FROM ${ODK_READONLY_USER};
SQL
done

psql -v ON_ERROR_STOP=1 -d "$ODK_DB" <<SQL
GRANT SELECT ON geometry_columns TO ${ODK_READONLY_USER};
GRANT SELECT ON geography_columns TO ${ODK_READONLY_USER};
SQL

echo "✓ Usuário ${ODK_READONLY_USER} pronto. Cadastre em GABI → Conexões com Fonte ODK marcada."
