# apps/api

RFC-0002 本地点餐系统接口服务模块。

本目录当前是 T1 确认的 API 服务边界：后续 T3 将在此实现菜品 CRUD、推荐接口、图片候选接口和数据库访问层。API 服务是前端与 Agent skill 的共同数据访问边界，负责校验、事务、推荐逻辑和 Postgres 访问。

## 本地预期

- 运行目录：`apps/api`
- 默认端口：`3001`
- 数据库连接：通过 `DATABASE_URL` 指向 Docker Compose 中的 `postgres` 服务
- 本地 Docker 镜像：`docker/api` 当前为 T1 占位服务，用于验证拓扑与端口配置
