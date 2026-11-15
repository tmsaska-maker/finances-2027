#!/usr/bin/env bash
# Finance-only manual deployment helper. NEVER touch screening40 containers or DB.
set -Eeuo pipefail
umask 077
SHA="${1:-}"
ACTION="${2:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected exact 40-char commit SHA" >&2; exit 2; }
[[ "$ACTION" == preflight || "$ACTION" == backup || "$ACTION" == apply ]] || exit 2
ROOT=/opt/finances-2027
APP="$ROOT/backend"
STAGE="/tmp/finances2027-$SHA"
BACKUPS="$ROOT/backups"
DUMP="$BACKUPS/finances2027-$SHA.dump"
MARKER="$STAGE/offsite-backup-verified.sha256"

[[ -d "$APP" && -f "$APP/compose.yaml" && -f "$APP/.env" ]] || {
 echo "Expected finance-only /opt/finances-2027/backend/compose.yaml and .env; abort." >&2; exit 1;
}
cd "$APP"
DC=(docker compose --env-file "$APP/.env" -f "$APP/compose.yaml")
# Refuse to operate on unrelated Docker projects, container names or the screening port.
test "$("${DC[@]}" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name",""))')" = finances2027 || {
 echo "Wrong Compose project; abort." >&2; exit 1;
}
"${DC[@]}" config --services | grep -Fxq db
"${DC[@]}" config --services | grep -Fxq api
"${DC[@]}" ps --status running --services | grep -Fxq db
"${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# Presence of exact original schema is mandatory. Never create a new database on deployment.
version="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT string_agg(version::text, chr(44) ORDER BY version) FROM schema_migrations"' | tr -d '\r')"
[[ "$version" == 1,2 || "$version" == 1,2,3 || "$version" == 1,2,3,4 || "$version" == 1,2,3,4,5 || "$version" == 1,2,3,4,5,6 ]] || {
 echo "Unexpected finance schema version set; abort." >&2; exit 1;
}
echo "Finance-only preflight PASS (schema versions present, no screening operations)."
if [[ "$ACTION" == preflight ]]; then exit 0; fi
[[ -d "$STAGE" ]] || { echo "Staged directory missing" >&2; exit 1; }
if [[ "$ACTION" == backup ]]; then
 mkdir -p "$BACKUPS"
 chmod 700 "$BACKUPS"
 [[ ! -e "$DUMP" ]] || { echo "Backup for this SHA already exists; abort to prevent overwrite" >&2; exit 1; }
 tmp="$(mktemp "$BACKUPS/.finances2027-XXXXXXXX.dump")"
 trap 'rm -f "$tmp"' EXIT
 "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$tmp"
 [[ -s "$tmp" ]]
 "${DC[@]}" exec -T db pg_restore --list < "$tmp" >/dev/null
 mv "$tmp" "$DUMP"
 chmod 600 "$DUMP"
 # Restore drill to isolated TEMP finance DB only. Not the live database.
 # Restore into a disposable finance-only database; always drop it after verification.
 drill_db="finances_drill_${SHA:0:12}"
 cleanup_drill() {
   "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb --if-exists -U "$POSTGRES_USER" "$1"' _ "$drill_db" >/dev/null 2>&1 || true
 }
 trap 'cleanup_drill; rm -f "$tmp"' EXIT
 "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$1"' _ "$drill_db"
 "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' _ "$drill_db" < "$DUMP"
 check="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$1" -c "SELECT count(*) FROM schema_migrations WHERE version=1"' _ "$drill_db" | tr -d '\r')"
 [[ "$check" == 1 ]] || { echo "Restore verification failed" >&2; exit 1; }
 cleanup_drill
 trap 'rm -f "$tmp"' EXIT
 sha256sum "$DUMP" > "$STAGE/backup.sha256"
 # Temporary SSH-downloadable copy, removed by workflow cleanup after S3 upload.
 cp "$DUMP" "$STAGE/backup-export.dump"
 chown "${SUDO_USER:?SUDO_USER required}" "$STAGE/backup-export.dump"
 chmod 600 "$STAGE/backup-export.dump"
 echo "Local finance backup and isolated restore drill PASS."
 exit 0
fi
# APPLY only after verified off-server backup has been copied and marked by the workflow.
[[ -s "$MARKER" && -s "$DUMP" ]] || { echo "Off-server backup acknowledgement missing; abort." >&2; exit 1; }
expected="$(cut -d' ' -f1 "$MARKER")"
actual="$(sha256sum "$DUMP" | cut -d' ' -f1)"
[[ "$expected" =~ ^[a-f0-9]{64}$ && "$expected" == "$actual" ]] || { echo "Backup checksum mismatch" >&2; exit 1; }
[[ -s "$STAGE/finances-api-$SHA.tar.gz" && -d "$STAGE/sql" ]] || { echo "Release package missing" >&2; exit 1; }
docker load -i "$STAGE/finances-api-$SHA.tar.gz" >/dev/null
docker image inspect "finances2027-api:$SHA" >/dev/null
for n in 003_category_catalog 004_category_seed 005_personal_classification 006_approved_category_aliases; do
 number="${n%%_*}"
 v="${number#0}"
 existing="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM schema_migrations WHERE version=$1"' _ "$v" | tr -d '\r')"
 [[ "$existing" == 0 || "$existing" == 1 ]] || exit 1
 if [[ "$existing" == 0 ]]; then
   echo "Applying finance migration $number"
   "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$STAGE/sql/$n.sql"
 fi
done
override="$STAGE/api-override.yaml"
printf 'services:\n  api:\n    image: finances2027-api:%s\n' "$SHA" > "$override"
# Preserve the original network, env, DB and bound port; only replace finance API image.
docker compose --env-file "$APP/.env" -f "$APP/compose.yaml" -f "$override" up -d --no-build --no-deps api
# A private authenticated smoke check from inside finance API (no token printed).
docker compose --env-file "$APP/.env" -f "$APP/compose.yaml" -f "$override" exec -T api node --input-type=module -e '
  const token=process.env.FINANCES_API_TOKEN;
  for (const path of ["/health","/categories?project=personal&type=income"]) {
    const r=await fetch("http://127.0.0.1:8091"+path,{headers:{authorization:"Bearer "+token}});
    if(!r.ok) throw new Error("Finance API smoke failed: "+path+" "+r.status);
    const data=await r.json();
    if(path.includes("categories") && !data.records?.some(x=>x.id==="per_rental_income_kyiv")) throw new Error("Finance category absent");
  }
  console.log("Finance API smoke PASS");
'
# Store the exact image override only after the authenticated finance API smoke passed.
# Do not edit base compose config or any Screening40 component.
install -m 600 "$override" "$APP/compose.finance-release.yaml"
echo "$SHA" > "$ROOT/finance-api-deployed-sha"
echo "Finance T011 deployment PASS. Historical transactions untouched. Screening40 not modified."
