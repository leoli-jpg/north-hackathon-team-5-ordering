# apps/api/database

RFC-0002 T2/T4 数据库 schema 与迁移脚本。

## 文件

- `schema.sql`：Postgres 初始化 SQL，包含菜品、标签、食材、推荐会话、图片候选表、索引和更新时间触发器。
- `migrate.js`：读取 `DATABASE_URL` 并执行 `schema.sql` 的 Node.js 迁移脚本。
- `fixtures/ocr_menu_demo.sql`：OCR 菜单图片候选演示数据，用于验证候选表不会绕过人工确认流程。
- `schema.test.js`：不依赖数据库连接的 schema contract test，验证 RFC-0002 要求的表、字段、约束、索引和触发器。

## 使用方式

```bash
cd apps/api
DATABASE_URL=postgres://ordering:ordering@localhost:5432/ordering npm run db:migrate
```

`schema.sql` 使用 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`，适合空库初始化和本地重复执行。

## 候选确认验证

1. 启动 Docker 迁移容器或执行 `npm run db:migrate` 初始化 schema。
2. 执行 `fixtures/ocr_menu_demo.sql` 导入 OCR 候选数据。
3. 通过 `POST /api/menu-items/from-candidates` 传入 `candidate_ids`，只有 pending 候选会被提升到 `menu_items`。
4. 未确认候选仍停留在 `menu_item_candidates`，正式菜单不会被动图识别结果污染。

## 契约测试

```bash
cd apps/api
node database/schema.test.js
```

该测试检查：

- `menu_items` 使用 `price_cents` 整数分存储金额。
- `tags` 类型枚举包含 ingredient、allergen、cuisine、spicy、diet 等类型。
- `recommendation_sessions` / `recommendation_items` 可保存推荐会话和明细。
- `menu_images` / `menu_item_candidates` 支持图片识别候选隔离。
- 关键索引和 `menu_items` 更新时间触发器存在。

