#!/usr/bin/env node
// RFC-0002: Validate the ordering database schema against the RFC-0002 contract.
// The script reads schema.sql and asserts table, constraint, index, and trigger names
// required by the API/database contract without requiring a live Postgres instance.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

function assertContains(label, text, needle) {
  assert.ok(text.includes(needle), `${label}: expected schema.sql to contain ${needle}`);
}

const requiredTables = [
  'menu_items',
  'tags',
  'menu_item_tags',
  'menu_item_ingredients',
  'recommendation_sessions',
  'recommendation_items',
  'menu_images',
  'menu_item_candidates',
];

const requiredColumns = [
  ['menu_items', 'price_cents INTEGER NOT NULL CHECK (price_cents >= 0)'],
  ['menu_items', "status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive'))"],
  ['tags', "type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'ingredient', 'allergen', 'cuisine', 'spicy', 'diet', 'other'))"],
  ['menu_item_ingredients', 'confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0 AND 1)'],
  ['recommendation_sessions', "status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))"],
  ['recommendation_items', 'quantity INTEGER NOT NULL CHECK (quantity > 0)'],
  ['menu_images', "source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'vision'))"],
  ['menu_item_candidates', "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'))"],
];

const requiredIndexes = [
  'idx_menu_items_active_price',
  'idx_menu_item_tags_tag_id',
  'idx_menu_item_ingredients_ingredient',
  'idx_recommendation_sessions_created_at',
  'idx_menu_items_name_fts',
  'idx_menu_item_candidates_source_image_id',
  'idx_menu_item_candidates_status_created_at',
  'idx_menu_images_status_created_at',
];

for (const tableName of requiredTables) {
  assertContains(`required table ${tableName}`, sql, `CREATE TABLE IF NOT EXISTS ${tableName}`);
}

for (const [tableName, columnDefinition] of requiredColumns) {
  assertContains(`required column ${tableName}.${columnDefinition}`, sql, columnDefinition);
}

for (const indexName of requiredIndexes) {
  assertContains(`required index ${indexName}`, sql, `CREATE INDEX IF NOT EXISTS ${indexName}`);
}

assertContains('pgcrypto extension', sql, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;');
assertContains('updated_at trigger', sql, 'CREATE TRIGGER trg_menu_items_updated_at');
assertContains('candidate source image FK', sql, 'source_image_id UUID REFERENCES menu_images(id) ON DELETE SET NULL');
assertContains('recommendation session FK', sql, 'session_id UUID NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE');

console.log('database schema contract tests passed');
