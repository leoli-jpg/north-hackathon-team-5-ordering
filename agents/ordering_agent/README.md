# NexAU 多人点餐推荐 Agent mock

本目录实现 RFC-0001 的本地点餐推荐 Agent mock 环境，用于演示“多人聚餐点餐推荐系统”的输入输出链路。

## 运行 mock

```bash
python -m agents.ordering_agent --pretty
```

该命令会读取：

- `agents/ordering_agent/data/sample_menu.txt`
- `agents/ordering_agent/data/sample_request.txt`

并输出结构化 JSON，包含菜单识别结果、成员需求、推荐方案、总价和约束说明。

## 测试

```bash
python -m pytest -q
```

当前测试覆盖菜单解析、成员需求提取、推荐约束、人工校正提示、重新生成方案和 JSON 输出契约。

## HTTP mock 服务

```bash
python -m agents.ordering_agent.server
```

服务启动后：

```bash
curl http://127.0.0.1:8000/health
```

提交推荐请求：

```bash
curl -X POST http://127.0.0.1:8000/recommend \
  -H 'Content-Type: application/json' \
  -d '{"menu_path":"agents/ordering_agent/data/sample_menu.txt","request_path":"agents/ordering_agent/data/sample_request.txt"}'
```

也可以直接传入文本：

```bash
curl -X POST http://127.0.0.1:8000/recommend \
  -H 'Content-Type: application/json' \
  -d '{"menu_text":"招牌牛肉饭 48元\n番茄鸡蛋饭 28元","request_text":"这次一共 2 个人，总预算 100 元。\n成员 A：我完全不吃辣。"}'
```

## NexAU Agent 配置

`agents/ordering_agent/ordering_agent.yaml` 是 NexAU Agent 配置入口：

- `systemprompt.md` 定义多人点餐推荐 Agent 的工作流、约束和工具使用原则。
- `tools/native/*.yaml` 声明原生文件、目录、图片/视频读取工具。
- `tools/local/run_ordering_mock.yaml` 声明本地点餐 mock 工具。
- `tools/mock_ordering.py` 实现当前端到端 mock 工具。

NexAU 的 `LLMConfig` 会按官方约定从环境变量读取 LLM 配置；YAML 使用 `${env.LLM_MODEL}`、`${env.LLM_BASE_URL}`、`${env.LLM_API_KEY}`。本地变量范围可通过 `.env.example` 中的 `SANDBOX_WORK_DIR` 配置。

```bash
cp .env.example .env
source .env
python -m nexau.cli chat agents/ordering_agent/ordering_agent.yaml
```

如果你使用其他兼容 OpenAI Chat Completions 的模型服务，只需要替换 `LLM_MODEL`、`LLM_BASE_URL` 和 `LLM_API_KEY`。
