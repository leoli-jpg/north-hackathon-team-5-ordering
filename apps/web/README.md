# apps/web

RFC-0003 多人点餐 Demo 前端模块。当前已经实现六步主流程，以及对 RFC-0002 API/Postgres 的 HTTP Adapter。

## 架构边界

- 页面只依赖稳定 View Model 和 Gateway，不直接拼接 API URL 或导入数据库 Client。
- HTTP Adapter 将菜单图片、确认后的菜品和推荐结果映射到 RFC-0002 API。
- API 是唯一数据库访问边界；浏览器不持有 `DATABASE_URL`。
- 默认是 `http-with-mock-fallback`：优先写入 Postgres，API 不可用时仍可完整演示。

## 本地启动

```bash
cd apps/web
npm install
npm run dev
```

默认访问地址：<http://localhost:3000>。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_RUNTIME_MODE` | `http-with-mock-fallback` | 设为 `mock` 可强制纯前端模式。 |
| `NEXT_PUBLIC_API_BASE_URL` | `/ordering-api` | 浏览器侧 API 前缀，默认由 Next.js 同源代理转发。 |
| `ORDERING_API_BASE_URL` | `http://127.0.0.1:3001` | Next.js 服务端代理目标。 |

## 已覆盖路由

| URL | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | 首页与 Demo 入口 | 可访问 |
| `/session/new` | 创建聚餐 | 已完成 |
| `/session/[sessionId]` | 会话根路径，重定向到菜单上传 | 可访问 |
| `/session/[sessionId]/menu` | 上传菜单 | 已完成 |
| `/session/[sessionId]/menu/review` | 校正菜单 | 已完成 |
| `/session/[sessionId]/members` | 成员需求 | 已完成 |
| `/session/[sessionId]/budget` | 预算优惠 | 已完成 |
| `/session/[sessionId]/result` | 推荐结果 | 已完成 |
| `/session/[sessionId]/share` | 分享协作 | 可选占位 |

## 验证命令

```bash
npm run typecheck
npm run build
npm run test:e2e
```
