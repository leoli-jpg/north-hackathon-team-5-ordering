# apps/web

RFC-0003 多人点餐 Demo 前端模块。

本目录当前实现 T1 的 Next.js App Router 骨架：首页、六步会话路由、会话 Layout、基础 Header / Stepper / BottomActionBar、设计 token 和全局样式。后续 T2-T6 会在此基础上补充稳定 View Model、Schema、Ports、Mock/HTTP Adapter、页面状态机和测试。

## 架构边界

- 页面只通过 App Router、Layout 和占位组件验证路由与视觉骨架。
- 后续页面不得直接拼接 API URL、导入数据库 Client 或在组件中裸调用 `fetch`。
- 真实后端、Agent Runtime 和实时协议必须通过 RFC-0003 定义的 Gateway/Adapter 层接入。
- 默认演示模式为 `mock`，不依赖外部服务即可运行。

## 本地启动

```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev
```

默认访问地址：<http://localhost:3000>。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_RUNTIME_MODE` | `mock` | 当前支持 `mock`；后续 T5/T6 可接入 `http`。 |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | HTTP Adapter 的基础地址，真实接口未冻结前仅作为配置占位。 |
| `NEXT_PUBLIC_REALTIME_URL` | 空 | 可选实时协议占位；不得放入数据库连接串、Agent Key 或服务端密钥。 |

## T1 已覆盖路由

| URL | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | 首页与 Demo 入口 | 可访问 |
| `/session/new` | 创建聚餐 | 表单占位 |
| `/session/[sessionId]` | 会话根路径，重定向到菜单上传 | 可访问 |
| `/session/[sessionId]/menu` | 上传菜单 | 页面占位 |
| `/session/[sessionId]/menu/review` | 校正菜单 | 页面占位 |
| `/session/[sessionId]/members` | 成员需求 | 页面占位 |
| `/session/[sessionId]/budget` | 预算优惠 | 页面占位 |
| `/session/[sessionId]/result` | 推荐结果 | 页面占位 |
| `/session/[sessionId]/share` | 分享协作 | 可选占位 |

## 验证命令

```bash
npm run typecheck
npm run build
```
