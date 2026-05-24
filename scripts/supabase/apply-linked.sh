#!/usr/bin/env bash
# Aplica o schema GABI no projeto Supabase linkado (idempotente).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! supabase projects list 2>/dev/null | grep -q '●'; then
  echo "Nenhum projeto linkado. Rode: supabase link --project-ref SEU_REF"
  exit 1
fi

for f in \
  scripts/supabase/01_gabi_schema.sql \
  scripts/supabase/02_gabi_permissions_seed.sql \
  scripts/supabase/03_seed_admin.sql \
  scripts/supabase/04_remove_placeholder_connection.sql \
  scripts/supabase/05_drop_demo_artifacts.sql \
  scripts/supabase/06_gabi_api_role.sql \
  scripts/supabase/07_page_scope.sql \
  scripts/supabase/08_geo_source.sql \
  scripts/supabase/09_gabi_module.sql
do
  echo "→ $f"
  supabase db query --linked --yes -f "$f"
done

echo "OK — migrations Supabase aplicadas."
