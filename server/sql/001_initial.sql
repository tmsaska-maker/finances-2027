-- F02 initial server-side schema. Run in a NEW finances-specific database only.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
  currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
  label text NOT NULL CHECK (length(trim(label)) > 0)
);
CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
  kind text NOT NULL CHECK (kind IN ('income','expense','transfer')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
  occurred_on date NOT NULL,
  source_id text NOT NULL CHECK (length(trim(source_id)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_id)
);
CREATE TABLE IF NOT EXISTS obligations (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  obligation_id text NOT NULL REFERENCES obligations(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
  state text NOT NULL CHECK (state IN ('planned','submitted','confirmed','rejected')),
  bank_transaction_id text REFERENCES transactions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'confirmed' OR bank_transaction_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_payments_obligation ON payments(obligation_id);
CREATE INDEX IF NOT EXISTS idx_tx_account_date ON transactions(account_id, occurred_on);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT(version) DO NOTHING;
COMMIT;
