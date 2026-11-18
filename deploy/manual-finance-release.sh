#!/usr/bin/env bash
# Finance-only manual deployment helper. NEVER touch screening40 containers or DB.
set -Eeuo pipefail
umask 077
SHA="${1:-}"
ACTION="${2:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected exact 40-char commit SHA" >&2; exit 2; }
[[ "$ACTION" == preflight || "$ACTION" == apply ]] || exit 2
ROOT=/opt/finances-2027
APP="$ROOT/backend/deploy"
STAGE="/tmp/finances2027-$SHA"

[[ -d "$APP" && -f "$APP/compose.yaml" && -f "$APP/.env" ]] || {
 echo "Expected finance-only /opt/finances-2027/backend/deploy/compose.yaml and .env; abort." >&2; exit 1;
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
[[ "$version" == 1,2 || "$version" == 1,2,3 || "$version" == 1,2,3,4 || "$version" == 1,2,3,4,5 || "$version" == 1,2,3,4,5,6 || "$version" == 1,2,3,4,5,6,7 || "$version" == 1,2,3,4,5,6,7,8 ]] || {
 echo "Unexpected finance schema version set; abort." >&2; exit 1;
}
echo "Finance-only preflight PASS (schema versions present, no screening operations)."
if [[ "$ACTION" == preflight ]]; then exit 0; fi
[[ -d "$STAGE" ]] || { echo "Staged directory missing" >&2; exit 1; }
# Refuse inconsistent migration/table combinations before applying changes.
schema_state="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (to_regclass('"'public.monthly_forecast_lines'"') IS NOT NULL)::int || chr(44) || (to_regclass('"'public.monthly_forecast_revisions'"') IS NOT NULL)::int"' | tr -d '\r')"
case "$version:$schema_state" in
  1,2,3,4,5,6:0,0|1,2,3,4,5,6,7:1,0|1,2,3,4,5,6,7,8:1,1) ;;
  *) echo "Unexpected forecast migration state; abort" >&2; exit 1 ;;
esac
test -s "$STAGE/finances-api-$SHA.tar.gz"
test -s "$STAGE/sql/007_monthly_forecast.sql"
test -s "$STAGE/sql/008_forecast_revision_audit.sql"
for n in 007_monthly_forecast 008_forecast_revision_audit; do
  v="$((10#${n%%_*}))"
  existing="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM schema_migrations WHERE version=$1"' _ "$v" | tr -d '\r')"
  [[ "$existing" == 0 || "$existing" == 1 ]] || exit 1
  if [[ "$existing" == 0 ]]; then
    echo "Applying finance migration $v"
    "${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$STAGE/sql/$n.sql"
  fi
done
final_versions="$("${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT string_agg(version::text, chr(44) ORDER BY version) FROM schema_migrations"' | tr -d '\r')"
[[ "$final_versions" == 1,2,3,4,5,6,7,8 ]] || { echo "Migrations not complete" >&2; exit 1; }
docker load -i "$STAGE/finances-api-$SHA.tar.gz" >/dev/null
docker image inspect "finances2027-api:$SHA" >/dev/null
override="$STAGE/api-override.yaml"
printf 'services:\n  api:\n    image: finances2027-api:%s\n' "$SHA" > "$override"
# Preserve the original network, env, DB and bound port; only replace finance API image.
docker compose --env-file "$APP/.env" -f "$APP/compose.yaml" -f "$override" up -d --no-build --no-deps api
# A private authenticated smoke check from inside finance API (no token printed).
docker compose --env-file "$APP/.env" -f "$APP/compose.yaml" -f "$override" exec -T api node --input-type=module -e '
  const token=process.env.FINANCES_API_TOKEN;
  for (const path of ["/health","/categories?project=personal&type=income","/forecast/monthly?month=2026-12"]) {
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
echo "Finance API + forecast migrations 007/008 deployed without backups or second database. Screening40 untouched."
