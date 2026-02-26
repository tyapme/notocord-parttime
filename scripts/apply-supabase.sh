#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "SUPABASE_DB_URL か DATABASE_URL を設定してください" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "supabase/phase1.sql"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "select pg_notify('pgrst', 'reload schema');"
echo "OK: phase1.sql 適用 + スキーマキャッシュ更新"
