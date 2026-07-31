# Docker 本地部署拓扑

RFC-0002 的本地基础设施层。`docker compose` 负责启动 **Postgres 数据库容器、迁移容器和 API 服务容器**；业务 API 已实现 T3 基础能力。

## 服务

| 服务 | 说明 |
| --- | --- |
| `postgres` | Postgres 16 数据库容器，暴露到宿主机 `POSTGRES_PORT`，默认 `5432` |
| `migrate` | 一次性迁移容器，使用 `apps/api` 镜像在容器内执行 `npm run db:migrate` |
| `api` | API 服务容器，默认暴露 `API_PORT=3001`，通过 Docker 网络内的 `DATABASE_URL` 连接 `postgres`，提供菜品 CRUD、推荐和图片候选接口 |

> 要求：本地验证和部署都通过 Docker 运行，不使用宿主机 Node.js 进程启动 API 或数据库。

## 环境变量

复制模板后按需修改：

```bash
cp .env.example .env
```

关键变量：

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- `POSTGRES_PORT`
- `API_PORT`
- `API_CORS_ORIGIN`
- `NODE_ENV`

## 启动与迁移

```bash
cd docker
docker compose up --build postgres migrate api
```

启动后：

- `postgres`：Docker 容器内 Postgres 16。
- `migrate`：Docker 容器内执行 schema 初始化。
- `api`：Docker 容器内启动 Node.js API 服务。
- API 对外暴露：`http://localhost:3001`

```bash
curl http://localhost:3001/
```

## 重新迁移数据库

如果 schema 变更，需要重新执行容器内迁移：

```bash
cd docker
docker compose run --rm migrate
```

如需重建数据库后重新迁移：

```bash
cd docker
docker compose down -v
docker compose up --build postgres migrate api
```

## 容器内测试

API 单元测试在 `api` 镜像的容器内执行：

```bash
cd docker
docker compose run --rm api npm test
```

## 容器内端到端验证

当 `api` 已启动时，可以在 `api` 容器内调用本机服务接口验证：

```bash
cd docker
docker compose exec -T api sh -lc 'curl -sS http://localhost:3001/'
```

端到端写库验证应通过容器内 API 调用 `api` 服务，并通过 `postgres` 容器查询数据库：

```bash
cd docker
docker compose exec -T api sh -lc 'curl -sS -X POST http://localhost:3001/api/menu-items -H "Content-Type: application/json" -d "{\"name\":\"番茄鸡蛋饭\",\"price_cents\":3000,\"status\":\"active\"}"'
docker compose exec -T postgres psql -U ordering -d ordering -c "SELECT name, price_cents FROM menu_items;"
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
