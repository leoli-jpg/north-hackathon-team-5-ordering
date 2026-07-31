# apps/web

RFC-0002 本地点餐系统前端模块。

本目录当前是 T1 确认的 Next.js 前端边界：后续 T4 将在此实现菜单管理与推荐结果展示页面。前端不直接连接 Postgres，只通过 `apps/api` 暴露的 HTTP 接口访问数据和推荐能力。

## 本地预期

- 运行目录：`apps/web`
- 框架：Next.js
- 默认访问地址：`http://localhost:3000`
- 默认 API 地址：`http://localhost:3001`
- 环境变量示例：`apps/web/.env.local.example` 将在后续 T4 随页面实现补充。
