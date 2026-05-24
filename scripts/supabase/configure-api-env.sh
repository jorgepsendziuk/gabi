#!/usr/bin/env bash
# Gera apps/api/.env.local com credenciais do pooler Supabase linkado.
# Uso: ./scripts/supabase/configure-api-env.sh 'SUA_SENHA_DO_POSTGRES'
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF_FILE="$ROOT/supabase/.temp/project-ref"
POOLER_FILE="$ROOT/supabase/.temp/pooler-url"
ENV_LOCAL="$ROOT/apps/api/.env.local"

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 'SENHA_POSTGRES'"
  echo "Senha: Supabase Dashboard → Project Settings → Database → Database password"
  exit 1
fi

PASSWORD="$1"
REF="$(cat "$REF_FILE")"
POOLER="$(cat "$POOLER_FILE")"
# postgresql://postgres.REF@host:5432/postgres
HOST_PORT="${POOLER#*@}"
HOST="${HOST_PORT%%/*}"
HOST="${HOST%%:*}"
PORT="${POOLER##*:}"
PORT="${PORT%%/*}"

cat > "$ENV_LOCAL" <<EOF
# Gerado por scripts/supabase/configure-api-env.sh — não commitar
DB_HOST=$HOST
DB_PORT=$PORT
DB_NAME=postgres
DB_USER=postgres.$REF
DB_PASSWORD=$PASSWORD
DB_SSL=true

# Alternativa: cole a URI completa do dashboard
# DATABASE_URL=postgresql://postgres.$REF:${PASSWORD}@${HOST}:${PORT}/postgres?sslmode=require
EOF

echo "Escrito: $ENV_LOCAL"
echo "Reinicie a API: pnpm --filter @gabi/api dev"
