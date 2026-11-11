#!/usr/bin/env bash
# Finance-only logical backup. Does NOT touch Screening40 volumes or containers.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
BACKUP_DIR="${FINANCES_BACKUP_DIR:-/var/backups/finances2027}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/finances2027-$stamp.dump"
tmp="$(mktemp "$BACKUP_DIR/.backup-XXXXXXXX.dump")"
trap 'rm -f "$tmp"' EXIT
docker compose --env-file .env -f compose.yaml exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$tmp"
test -s "$tmp"
# Format validation without restoring into the live finance DB.
docker compose --env-file .env -f compose.yaml exec -T db pg_restore --list < "$tmp" >/dev/null
mv -n "$tmp" "$output"
chmod 600 "$output"
echo "Finance backup created and listed: $output"
echo "Note: also copy this encrypted/off-host and test restore; local copy alone is insufficient."
