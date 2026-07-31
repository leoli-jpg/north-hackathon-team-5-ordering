-- RFC-0002: Ordering system database schema for T2.
-- This file is intentionally idempotent so it can be used both as an initialization
-- script for fresh Postgres containers and as a reference migration for local demos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
  image_url TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'ingredient', 'allergen', 'cuisine', 'spicy', 'diet', 'other')),
  description TEXT
);

DO $$
BEGIN
  ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_type_check;
  ALTER TABLE tags ADD CONSTRAINT tags_type_check
    CHECK (type IN ('general', 'ingredient', 'allergen', 'cuisine', 'spicy', 'diet', 'other'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS menu_item_tags (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (menu_item_id, ingredient)
);

CREATE TABLE IF NOT EXISTS recommendation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_cents INTEGER NOT NULL CHECK (budget_cents > 0),
  person_count INTEGER NOT NULL CHECK (person_count > 0),
  member_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_items (
  session_id UUID NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  PRIMARY KEY (session_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS menu_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'vision')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_item_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_image_id UUID REFERENCES menu_images(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_active_price ON menu_items(status, price_cents);
CREATE INDEX IF NOT EXISTS idx_menu_item_tags_tag_id ON menu_item_tags(tag_id, menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient);
CREATE INDEX IF NOT EXISTS idx_recommendation_sessions_created_at ON recommendation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_name_fts ON menu_items USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_menu_item_candidates_source_image_id ON menu_item_candidates(source_image_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_candidates_status_created_at ON menu_item_candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_images_status_created_at ON menu_images(status, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON menu_items;
CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
