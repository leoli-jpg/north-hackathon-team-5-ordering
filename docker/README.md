# Docker 本地部署拓扑

RFC-0002 的本地基础设施层。当前 T1 只确认拓扑与模块边界，不实现完整业务服务。

## 服务

| 服务 | 说明 |
| --- | --- |
| `postgres` | Postgres 16 本地数据库，暴露到宿主机 `POSTGRES_PORT`，默认 `5432` |
| `api` | 接口服务容器，默认暴露 `API_PORT=3001`，通过 `DATABASE_URL` 连接 `postgres` |

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

## 启动

```bash
docker compose up postgres api
```

当前 `apps/api` 镜像为 T1 占位服务，仅用于验证 Docker Compose 拓扑、环境变量注入和端口映射。T3 会替换为真实 Node.js/TypeScript API 服务。
