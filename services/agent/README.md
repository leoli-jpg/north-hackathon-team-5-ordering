# services/agent

RFC-0002 本地点餐系统 Agent skill 模块。

本目录当前是 T1 确认的 NexAU Agent skill 边界：后续 T5 将在此实现 skill 包装层，将 Agent 的自然语言请求转换为对 `apps/api` 的结构化调用，并把推荐结果转回 Agent 可解释输出。Agent 不直接连接 Postgres，也不直接操作前端 UI。

## 本地预期

- 运行目录：`services/agent`
- 入口：`python -m services.agent.run`
- 默认 API 地址：`http://localhost:3001`
- 环境变量示例：`services/agent/.env.example` 将在后续 T5 随 skill 实现补充。
