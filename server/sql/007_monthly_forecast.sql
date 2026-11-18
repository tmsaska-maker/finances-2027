-- F03: monthly FORECAST is separate from immutable BUDGET, obligations and ACTUAL.
-- Additive: existing finance records are not rewritten. Deploy only via reviewed finance-only migration process.
BEGIN;
CREATE TABLE IF NOT EXISTS monthly_forecast_lines (
 id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 120),
 month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
 category_id text NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
 amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
 due_date date NOT NULL,
 source_template_id text NOT NULL CHECK (length(source_template_id) BETWEEN 1 AND 120),
 recurring boolean NOT NULL DEFAULT true,
 amount_kind text NOT NULL CHECK (amount_kind IN ('fixed','estimated')),
 status text NOT NULL DEFAULT 'draft' CHECK (status='draft'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (to_char(due_date,'YYYY-MM')=month),
 UNIQUE (month,project,source_template_id)
);
CREATE INDEX IF NOT EXISTS idx_monthly_forecast_month ON monthly_forecast_lines(month,project);
-- No obligation creation and no bank transaction creation from forecast line inserts.
INSERT INTO schema_migrations(version) VALUES(7) ON CONFLICT(version) DO NOTHING;
COMMIT;
