-- F02/T011: a shared, project-scoped classification catalogue.
-- No real data, no automatic conversion of historical text categories.
-- Additive migration: do not rewrite existing transactions or obligations.
BEGIN;

CREATE TABLE IF NOT EXISTS finance_categories (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{0,79}$'),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name text NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 160),
  parent_id text REFERENCES finance_categories(id) ON DELETE RESTRICT,
  economic_type text NOT NULL CHECK (economic_type IN ('expense', 'income', 'non_consumption')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

-- A "subcategory" must be a direct child of a root category, of the same economic type.
-- Validate parent changes too: a category which already has children cannot become a child.
CREATE OR REPLACE FUNCTION finance_category_hierarchy_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_row record;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id, economic_type INTO parent_row
    FROM finance_categories WHERE id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown category parent' USING ERRCODE = '23503';
    END IF;
    IF parent_row.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only two category levels are supported' USING ERRCODE = '23514';
    END IF;
    IF parent_row.economic_type <> NEW.economic_type THEN
      RAISE EXCEPTION 'Category economic type must match its parent' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM finance_categories WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'Category with children cannot become a subcategory' USING ERRCODE = '23514';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM finance_categories child
    WHERE child.parent_id = NEW.id AND child.economic_type <> NEW.economic_type
  ) THEN
    RAISE EXCEPTION 'Changing category type would invalidate its children' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finance_category_hierarchy_guard ON finance_categories;
CREATE TRIGGER finance_category_hierarchy_guard
BEFORE INSERT OR UPDATE OF parent_id, economic_type ON finance_categories
FOR EACH ROW EXECUTE FUNCTION finance_category_hierarchy_guard();

CREATE INDEX IF NOT EXISTS idx_finance_categories_parent
  ON finance_categories(parent_id);

-- Explicitly enabled classification choices, not duplicated categories.
CREATE TABLE IF NOT EXISTS project_category_access (
  project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
  category_id text NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (project, category_id)
);
CREATE INDEX IF NOT EXISTS idx_project_category_access_category
  ON project_category_access(category_id);

-- Only approved historical mappings; keep source names intact for traceability.
-- A source row can map differently across projects; no implicit fuzzy matching.
CREATE TABLE IF NOT EXISTS category_source_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project text NOT NULL CHECK (project IN ('ambulatory','screening','psychotherapy','personal')),
  source_file text NOT NULL CHECK (length(trim(source_file)) > 0 AND length(source_file) <= 200),
  source_label text NOT NULL CHECK (length(trim(source_label)) > 0 AND length(source_label) <= 200),
  category_id text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text NOT NULL CHECK (length(trim(reviewed_by)) > 0 AND length(reviewed_by) <= 120),
  UNIQUE (project, source_file, source_label),
  FOREIGN KEY (project, category_id)
    REFERENCES project_category_access(project, category_id) ON DELETE RESTRICT
);

INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT (version) DO NOTHING;
COMMIT;
