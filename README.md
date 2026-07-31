# north-hackathon-team-5-ordering

RFC-0002 点餐系统本地 MVP 仓库。

## 本地部署拓扑

本地演示环境按 RFC-0002 划分为四个模块边界：

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Next.js 前端 | `apps/web` | 菜单管理、推荐结果展示、图片候选确认入口 |
| 接口服务 | `apps/api` | REST API、推荐引擎、图片候选接口、数据库访问边界；通过 Docker 容器运行 |
| Postgres | `docker/compose.yaml` | 本地持久化数据库容器 |
| Agent skill | `services/agent` | NexAU Agent 到 API 服务的 skill 包装层 |
| 共享包 | `packages/shared` | 前后端与 Agent skill 共享类型、DTO、常量 |

调用关系：

```mermaid
flowchart TD
    U["用户"] --> FE["Next.js 前端"]
    FE --> API["接口服务 / API"]
    API --> DB[("Postgres")]
    AG["NexAU Agent"] --> SKILL["Agent Skill 层"]
    SKILL --> API
```

## 本地启动

1. 复制环境变量模板：

   ```bash
   cp docker/.env.example docker/.env
   ```

2. 启动 Postgres、迁移容器与 API 服务容器：

   ```bash
   cd docker
   docker compose up --build postgres migrate api
   ```

3. 在另一个终端启动 Next.js 前端（T4 实现后）：

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

4. 启动 Agent（T5 实现后）：

   ```bash
   python -m services.agent.run
   ```

## 环境变量

- `DATABASE_URL`：API 服务内部连接 Postgres 的 URL，Docker Compose 中默认指向 `postgres:5432/ordering`。
- `API_CORS_ORIGIN`：前端默认来源，本地为 `http://localhost:3000`。
- `API_PORT`：接口服务端口，本地默认 `3001`。
- `POSTGRES_PORT`：宿主机暴露端口，本地默认 `55432`，避免占用本机默认 Postgres 端口。

## 当前状态

- T1 已完成：本地目录边界、Docker Compose 基础拓扑、环境变量模板和模块 README 已确认。
- T2 已完成：数据库 schema 与迁移脚本已实现。
- T3 已完成：API 服务已实现菜品 CRUD、推荐接口、图片候选识别与人工确认入库接口。
