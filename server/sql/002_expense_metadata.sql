-- Add form metadata without touching existing finance payments.
BEGIN;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS planned_bank text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT(version) DO NOTHING;
COMMIT;
