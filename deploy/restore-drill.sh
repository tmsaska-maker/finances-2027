#!/usr/bin/env bash
# Verifies an existing finance dump by restoring it into a temporary database
# on the FINANCES postgres service. Never overwrites finances2027.
set -Eeuo pipefail
umask 077
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: ./restore-drill.sh /absolute/path/to/finances2027-*.dump" >&2
  exit 2
fi
backup="$(realpath "$1")"
cd "$(dirname "$0")"
db="finances_restore_$(date -u +%s)_$$"
clean() {
  docker compose --env-file .env -f compose.yaml exec -T db \
    sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb --if-exists -U "$POSTGRES_USER" "$1"' _ "$db" >/dev/null 2>&1 || true
}
trap clean EXIT
docker compose --env-file .env -f compose.yaml exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$1"' _ "$db"
docker compose --env-file .env -f compose.yaml exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' _ "$db" < "$backup"
result="$(docker compose --env-file .env -f compose.yaml exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$1" -Atqc "SELECT count(*) FROM schema_migrations WHERE version=1"' _ "$db")"
[[ "$result" == "1" ]] || { echo "Restore drill failed: migration marker missing" >&2; exit 1; }
echo "Finance restore drill passed in temporary DB $db. Cleanup scheduled."
