#!/usr/bin/env bash
# Read-only inspection of FINANCES-ONLY live PostgreSQL; never print private rows, values, secrets.
set -Eeuo pipefail
umask 077
APP=/opt/finances-2027/backend/deploy
[[ -f "$APP/compose.yaml" && -f "$APP/.env" ]] || { echo "Finance compose missing" >&2; exit 1; }
DC=(docker compose --env-file "$APP/.env" -f "$APP/compose.yaml")
[[ "$("${DC[@]}" config --format json | python3 -c 'import json,sys;print(json.load(sys.stdin).get("name",""))')" == finances2027 ]] || exit 1
"${DC[@]}" config --services | grep -Fxq db
echo "FINANCE_LIVE_AUDIT_BEGIN (counts and category IDs only; no financial rows)"
"${DC[@]}" exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 'schema_versions|' || COALESCE(string_agg(version::text, ',' ORDER BY version),'none') FROM schema_migrations;
SELECT 'catalogue_categories|' || count(*) FROM finance_categories;
SELECT 'catalogue_roots|' || count(*) FROM finance_categories WHERE parent_id IS NULL;
SELECT 'catalogue_children|' || count(*) FROM finance_categories WHERE parent_id IS NOT NULL;
SELECT 'category_source_aliases|' || count(*) FROM category_source_aliases;
SELECT 'access|' || project || '|' || economic_type || '|' || count(*)
FROM project_category_access a JOIN finance_categories c ON c.id=a.category_id
WHERE a.enabled AND c.active GROUP BY project,economic_type ORDER BY project,economic_type;
SELECT 'missing_catalogue_access|' || count(*) FROM project_category_access a LEFT JOIN finance_categories c ON c.id=a.category_id WHERE c.id IS NULL;
SELECT 'catalogue_inconsistent_parent_type|' || count(*) FROM finance_categories child JOIN finance_categories parent ON parent.id=child.parent_id WHERE child.economic_type<>parent.economic_type;
SELECT 'catalogue_deeper_than_two_levels|' || count(*) FROM finance_categories child JOIN finance_categories p ON p.id=child.parent_id WHERE p.parent_id IS NOT NULL;
SELECT 'approved_examples|' || id || '|' || economic_type || '|' || active FROM finance_categories
WHERE id IN ('per_rental_income_kyiv','per_food_groceries','psy_training_main_group','amb_rent') ORDER BY id;
SELECT 'data_rows|accounts|' || count(*) FROM accounts;
SELECT 'data_rows|transactions|' || count(*) FROM transactions;
SELECT 'data_rows|obligations|' || count(*) FROM obligations;
SELECT 'data_rows|payments|' || count(*) FROM payments;
SELECT 'data_by_project|accounts|' || project || '|' || count(*) FROM accounts GROUP BY project ORDER BY project;
SELECT 'data_by_project|transactions|' || project || '|' || count(*) FROM transactions GROUP BY project ORDER BY project;
SELECT 'data_by_project|obligations|' || project || '|' || count(*) FROM obligations GROUP BY project ORDER BY project;
-- Preflight for migrations 007 and 008: metadata only; no writes and no finance amounts.
SELECT 'forecast_007_migration_recorded|' || EXISTS (SELECT 1 FROM schema_migrations WHERE version=7);
SELECT 'forecast_008_migration_recorded|' || EXISTS (SELECT 1 FROM schema_migrations WHERE version=8);
SELECT 'forecast_lines_table_present|' || (to_regclass('public.monthly_forecast_lines') IS NOT NULL);
SELECT 'forecast_revisions_table_present|' || (to_regclass('public.monthly_forecast_revisions') IS NOT NULL);
SELECT 'forecast_lines_required_columns|' ||
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='monthly_forecast_lines'
     AND column_name IN ('id','month','project','category_id','title','currency',
       'amount_minor','due_date','source_template_id','recurring','amount_kind','status','created_at'));
SELECT 'forecast_revisions_required_columns|' ||
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='monthly_forecast_revisions'
     AND column_name IN ('id','forecast_line_id','old_amount_minor','new_amount_minor',
       'old_due_date','new_due_date','revised_at'));
SELECT 'forecast_lines_unique_month_project_template|' || EXISTS (
  SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
  WHERE t.oid=to_regclass('public.monthly_forecast_lines')
    AND c.contype='u' AND pg_get_constraintdef(c.oid) LIKE '%month, project, source_template_id%'
);
SELECT 'forecast_revisions_foreign_key|' || EXISTS (
  SELECT 1 FROM pg_constraint c
  WHERE c.conrelid=to_regclass('public.monthly_forecast_revisions') AND c.contype='f'
);
COMMIT;
SQL
echo "FINANCE_LIVE_AUDIT_END"
