# F02 — фінансовий домен та збереження (перший інкремент)

## Готово

- Versioned schema `schemaVersion: 1` for project-separated transactions, obligations, payments.
- Strict parsing for money in minor units, currencies UAH/USD/EUR, valid ISO dates and duplicate identifiers.
- Only bank-linked, confirmed payments count toward settling obligations.
- `LedgerStore` persists a whole validated snapshot through a replaceable storage port; `MemoryStore` is used in tests.
- Reopening a stored snapshot, rejected writes, unsupported future schemas, and malformed records are covered by automated tests.

## Не готово — потрібне до реальних даних

- This is **not** a database or a server API. The demo app UI is not connected to `LedgerStore` yet.
- There is **no** multi-user concurrency, durable transactional database, backup, audit history, authentication or access-control layer.
- **Never** put actual patient, payroll, banking or personal financial details into public demo or browser localStorage.
- Next: design PostgreSQL migrations, authenticated backend API, backup/restore drills, and idempotent source imports; attach UI only after server protection.
