# apps/api/database

RFC-0002 T2 数据库 schema 与迁移脚本。

## 文件

- `schema.sql`：Postgres 初始化 SQL，包含菜品、标签、食材、推荐会话、图片候选表、索引和更新时间触发器。
- `migrate.js`：读取 `DATABASE_URL` 并执行 `schema.sql` 的 Node.js 迁移脚本。

## 使用方式

```bash
cd apps/api
DATABASE_URL=postgres://ordering:ordering@localhost:5432/ordering npm run db:migrate
```

`schema.sql` 使用 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`，适合空库初始化和本地重复执行。
