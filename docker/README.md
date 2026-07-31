# RFC-0002 Docker 本地部署与验证指南

本指南覆盖 RFC-0002 的本地 Docker 启动、数据库迁移、API 测试、API 契约与候选确认流程验证。所有业务 API 均通过 `apps/api` 访问 Postgres，前端或 Agent 不应直连数据库。

## 前置条件

- Docker Desktop 或支持 Docker Compose v2 的 Docker 环境
- Node.js 20（仅用于宿主机运行 `npm test`；容器内测试不依赖宿主机 Node.js）
- 可选：`psql`、`curl`、`jq`，用于手动验证数据库和 API 响应

## 环境变量

```bash
cd docker
cp .env.example .env
```

关键变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `POSTGRES_USER` | `ordering` | Postgres 用户名 |
| `POSTGRES_PASSWORD` | `ordering` | Postgres 密码 |
| `POSTGRES_DB` | `ordering` | Postgres 数据库名 |
| `POSTGRES_PORT` | `55432` | 宿主机暴露端口，避免占用本机默认 5432 |
| `API_PORT` | `3001` | API 服务暴露端口 |
| `API_CORS_ORIGIN` | `http://localhost:3000` | 前端本地来源 |
| `NODE_ENV` | `development` | API 运行环境 |

## 启动数据库、迁移与 API

```bash
cd docker
docker compose up --build postgres migrate api
```

启动后：

- `postgres`：Postgres 16 容器，容器内地址 `postgres:5432`，宿主机地址 `localhost:55432`。
- `migrate`：一次性迁移容器，执行 `npm run db:migrate` 应用 `apps/api/database/schema.sql`。
- `api`：Node.js API 服务容器，默认暴露 `http://localhost:3001`。

健康检查命令：

```bash
curl -sS http://localhost:3001/
```

期望返回：

```json
{
  "service": "ordering-api",
  "status": "ok",
  "rfc": "RFC-0002",
  "endpoints": [
    "GET /api/menu-items",
    "POST /api/menu-items",
    "POST /api/recommendations",
    "POST /api/menu-images",
    "POST /api/menu-items/from-candidates"
  ]
}
```

## 容器内运行测试

API 测试包含数据库 schema contract、推荐引擎、API-Agent contract mock、服务导出与路由 smoke tests：

```bash
cd docker
docker compose run --rm api npm test
```

期望输出包含：

- `database schema contract tests passed`
- `recommendation unit tests passed`
- `API-Agent recommendation contract tests passed`
- `server smoke tests passed`
- `api route smoke tests passed`

## 宿主机运行 API 测试

如果只需要快速验证文件级测试，可在宿主机执行：

```bash
cd apps/api
npm test
```

## 手动验证菜单 CRUD

```bash
curl -sS -X POST http://localhost:3001/api/menu-items \
  -H 'Content-Type: application/json' \
  -d '{"name":"番茄鸡蛋饭","description":"鸡蛋 + 番茄 + 米饭","price_cents":2800,"category":"主食","tags":["辣度:无"],"ingredients":["鸡蛋","番茄","米饭"],"attributes":{"spicy_level":"none"}}'
```

查询列表：

```bash
curl -sS 'http://localhost:3001/api/menu-items?status=active&page=1&page_size=10'
```

数据库验证：

```bash
docker compose exec -T postgres psql -U ordering -d ordering \
  -c "SELECT name, price_cents, status FROM menu_items ORDER BY created_at DESC;"
```

## 手动验证推荐流程

```bash
curl -sS -X POST http://localhost:3001/api/recommendations \
  -H 'Content-Type: application/json' \
  -d '{"budget_cents":25000,"person_count":5,"member_constraints":[{"member_id":"A","allergies":["peanut"],"spicy_tolerance":"none"},{"member_id":"B","dislikes":["pork"],"spicy_tolerance":"mild"}],"engine":"local"}'
```

响应应包含：

- `session_id`
- `total_price_cents`
- `items`
- `reasons`
- `conflicts`

查询推荐会话：

```bash
curl -sS http://localhost:3001/api/recommendations/:session_id
```

数据库验证：

```bash
docker compose exec -T postgres psql -U ordering -d ordering \
  -c "SELECT id, budget_cents, person_count, status FROM recommendation_sessions ORDER BY created_at DESC LIMIT 5;"
```

## 手动验证图片候选确认流程

保存菜单图片：

```bash
curl -sS -X POST http://localhost:3001/api/menu-images \
  -H 'Content-Type: application/json' \
  -d '{"file_name":"ocr-menu-demo.png","storage_path":"demo/ocr-menu-demo.png","mime_type":"image/png","source":"ocr"}'
```

触发识别候选：

```bash
curl -sS -X POST http://localhost:3001/api/menu-images/:image_id/recognize \
  -H 'Content-Type: application/json' \
  -d '{"candidates":[{"name":"红烧牛肉面","description":"牛肉 + 面条","price_cents":3200,"tags":["牛肉"],"ingredients":["牛肉","面条"],"attributes":{"category":"主食"},"confidence":0.96}],"recognition":{"provider":"manual-mock"}}'
```

确认候选入库：

```bash
curl -sS -X POST http://localhost:3001/api/menu-items/from-candidates \
  -H 'Content-Type: application/json' \
  -d '{"candidate_ids":["candidate_uuid"]}'
```

数据库验证：

```bash
docker compose exec -T postgres psql -U ordering -d ordering \
  -c "SELECT name, price_cents, status FROM menu_item_candidates ORDER BY created_at DESC;"
```

未确认候选仍为 `pending`，已确认候选为 `accepted`；只有确认后的候选会进入 `menu_items`。

## 重新迁移数据库

```bash
cd docker
docker compose run --rm migrate
```

如需重建数据库并重新迁移：

```bash
cd docker
docker compose down -v
docker compose up --build postgres migrate api
```

## 停止服务

```bash
cd docker
docker compose down
```

如需同时删除数据库持久化卷：

```bash
cd docker
docker compose down -v
```

## 契约文档

- API REST 契约：`../apps/api/CONTRACTS.md`
- API-Agent 推荐编排 mock 测试：`../apps/api/src/agent-contract.test.js`
- 数据库 schema contract 测试：`../apps/api/database/schema.test.js`
- RFC 文档：`../docs/rfcs/0002-ordering-system-architecture.md`
