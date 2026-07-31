-- RFC-0002: Demo OCR menu candidates for image-recognition challenge validation.
-- Run this after apps/api/database/migrate.js so the schema exists.
-- The source image represents a scanned paper menu; extracted rows stay in
-- menu_item_candidates until a human or future workflow explicitly accepts them.

INSERT INTO menu_images (id, file_name, storage_path, mime_type, source, status, raw_response)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ocr-menu-demo.png',
  'demo/ocr-menu-demo.png',
  'image/png',
  'ocr',
  'processed',
  '{"items":[{"name":"红烧牛肉面","price_cents":3200,"category":"主食","raw_text":"红烧牛肉面 ¥32"},{"name":"香菇鸡肉饭","price_cents":2800,"category":"主食","raw_text":"香菇鸡肉饭 ¥28"},{"name":"冰绿茶","price_cents":1200,"category":"饮品","raw_text":"冰绿茶 ¥12"}]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  file_name = EXCLUDED.file_name,
  storage_path = EXCLUDED.storage_path,
  mime_type = EXCLUDED.mime_type,
  source = EXCLUDED.source,
  status = EXCLUDED.status,
  raw_response = EXCLUDED.raw_response;

INSERT INTO menu_item_candidates (id, source_image_id, name, price_cents, attributes, confidence, status)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '红烧牛肉面',
    3200,
    '{"category":"主食","raw_text":"红烧牛肉面 ¥32","ocr_confidence":0.96}'::jsonb,
    0.96,
    'pending'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    '香菇鸡肉饭',
    2800,
    '{"category":"主食","raw_text":"香菇鸡肉饭 ¥28","ocr_confidence":0.94}'::jsonb,
    0.94,
    'pending'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    '冰绿茶',
    1200,
    '{"category":"饮品","raw_text":"冰绿茶 ¥12","ocr_confidence":0.98}'::jsonb,
    0.98,
    'pending'
  )
ON CONFLICT (id) DO UPDATE SET
  source_image_id = EXCLUDED.source_image_id,
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  attributes = EXCLUDED.attributes,
  confidence = EXCLUDED.confidence,
  status = EXCLUDED.status;
