-- T015: immutable audit entries for corrections to forecast estimates.
-- No alteration of BUDGET, obligations, payments or bank transactions.
BEGIN;
CREATE TABLE IF NOT EXISTS monthly_forecast_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 forecast_line_id text NOT NULL REFERENCES monthly_forecast_lines(id) ON DELETE RESTRICT,
 old_amount_minor bigint NOT NULL CHECK(old_amount_minor>0),
 new_amount_minor bigint NOT NULL CHECK(new_amount_minor>0),
 old_due_date date NOT NULL,
 new_due_date date NOT NULL,
 revised_at timestamptz NOT NULL DEFAULT now(),
 CHECK(old_amount_minor<>new_amount_minor OR old_due_date<>new_due_date)
);
CREATE INDEX IF NOT EXISTS idx_monthly_forecast_revisions_line
 ON monthly_forecast_revisions(forecast_line_id,id);
INSERT INTO schema_migrations(version) VALUES(8) ON CONFLICT(version) DO NOTHING;
COMMIT;
