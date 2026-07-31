# apps/api

RFC-0002 本地点餐系统接口服务模块。

T3 已实现接口服务基础能力：菜品 CRUD、推荐接口、图片候选识别与人工确认入库接口。API 服务是前端与 Agent skill 的共同数据访问边界，负责校验、事务、推荐逻辑和 Postgres 访问。

## 本地预期

- 运行目录：`apps/api`
- 默认端口：`3001`
- 数据库连接：通过 `DATABASE_URL` 指向 Docker Compose 中的 `postgres` 服务
- 本地 Docker 镜像：`docker/api` 已构建为真实 Node.js API 服务

## 主要接口

- `GET /api/menu-items`：查询菜品列表，支持 `keyword`、`category`、`status`、`page`、`page_size`。
- `POST /api/menu-items`：新增菜品，同时写入 `tags`、`menu_item_tags`、`ingredients`、`menu_item_ingredients`。
- `GET /api/menu-items/:id`：查询单个菜品及关联标签、食材。
- `PATCH /api/menu-items/:id`：部分更新菜品，可同步更新标签和食材。
- `DELETE /api/menu-items/:id`：删除菜品。
- `POST /api/recommendations`：基于预算、人数、过敏、忌口、辣度等约束生成推荐结果。
- `GET /api/recommendations/:id`：查询已保存的推荐会话。
- `POST /api/menu-images`：保存菜单图片元数据，返回图片记录。
- `POST /api/menu-images/:id/recognize`：接收识别候选，写入 `menu_item_candidates`，不直接写入正式菜单。
- `POST /api/menu-items/from-candidates`：人工确认后，将 pending 候选提升为正式菜品。

## 契约与测试

- `CONTRACTS.md`：记录菜品 CRUD、推荐、图片候选、API-Agent 推荐编排的结构化请求/响应契约。
- `database/schema.test.js`：验证 RFC-0002 数据库 schema 的表、字段、约束、索引和更新时间触发器。
- `src/agent-contract.test.js`：验证 API 发给 Agent 的推荐上下文与 Agent 返回推荐组合的字段契约。
- `npm test`：顺序运行数据库 schema、推荐引擎、API-Agent contract mock、服务导出和路由 smoke tests。

## 本地命令

```bash
npm install
npm run db:migrate
npm start
npm test
```
