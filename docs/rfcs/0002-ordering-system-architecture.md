# RFC-0002: 点餐系统架构与数据库 Schema 设计

## 摘要

本 RFC 设计 TOPIC B「点餐系统」的后端基础架构：本地接口服务负责菜品 CRUD、推荐编排、Agent 服务调用、推荐结果落库、图片候选识别接口和数据库访问；Postgres 作为本地持久化数据库；前端和 NexAU Agent 作为外部调用方通过 API 契约访问数据与推荐能力。

本 RFC 首期聚焦 MVP：维护稳定的数据库 schema、API 服务、Docker 本地部署方式，以及推荐、图片候选和 API-Agent 契约。前端页面实现由 RFC-0003 负责，Agent 内部 prompt、运行时和工具编排由 Agent 服务维护；本 RFC 只承诺接口、数据库表、API-Agent 契约和容器化部署边界。

## 动机

RFC-0001 已定义 NexAU 多人点餐推荐 Agent 的能力边界，RFC-0003 已推进前端 Demo 架构。首期可演示业务系统需要先把菜单数据持久化、把推荐逻辑集中到可测试的 API 服务中，并提供稳定的数据访问边界。

如果缺少统一架构和数据库 schema，容易出现三类问题：调用方直接操作数据库导致权限和部署复杂；推荐逻辑散落在前端或 Agent 中导致结果不可复现；图片识别结果直接写入正式菜单导致错误数据污染推荐链路。因此本 RFC 将系统边界收敛为接口服务、数据库和 Docker 部署，并用候选表隔离图片识别风险。

## 设计

### 概述

本地演示环境采用以下拓扑：

- `apps/api`：接口服务，承载 REST API、数据库访问、推荐编排、Agent 服务调用和图片候选能力。
- `apps/api/database/`：数据库 schema 与迁移脚本。
- `docker/`：Postgres、migrate 与 API 服务的本地容器编排。
- 前端 Demo（`apps/web`，RFC-0003）：通过 API 新增/修改菜品，并通过 API 提交预算金额获取推荐菜品组合。
- Agent 服务：由外部维护，API 在生成推荐时调用 Agent 服务；Agent 需要查询菜品信息时也只调用 API。

```mermaid
flowchart TD
    FE["前端 / RFC-0003"] -->|菜品 CRUD / 推荐请求| API["接口服务 / API"]
    API -->|推荐编排 / Agent 调用| AG["Agent 服务"]
    AG -->|查询菜品信息| API
    API --> DB[("Postgres")]
    API --> REC["推荐编排与落库"]
    API --> IMG["图片上传 / 候选识别"]
    API --> MIG["migrate 容器"]
    MIG --> DB

    API -->|REST| FE
    API -->|REST / tool call| AG
```

核心原则：

1. **调用方不直连数据库**：前端和 Agent 都通过 API 服务访问数据。
2. **API 是唯一落库边界**：前端新增菜品、推荐结果、图片候选确认均由 API 写入数据库。
3. **Agent 只生成推荐组合**：Agent 不负责正式菜单 CRUD，不直接写 `menu_items` 或推荐结果表。
4. **推荐结果由 API 编排和落库**：API 负责调用 Agent、校验 Agent 返回、写入 `recommendation_sessions` / `recommendation_items`，再返回前端。
5. **图片识别走候选表**：识别结果先进入 staging 区，再人工确认后进入正式菜品表。
6. **服务与数据库容器化**：验证和部署时，API、迁移任务和 Postgres 均在 Docker 容器中运行。

### 范围与非目标

#### 首期范围

- 维护菜品基础字段：名称、描述、价格、分类、状态、图片 URL、扩展属性。
- 维护菜品标签、食材、过敏原、辣度等结构化信息。
- 提供菜品 CRUD，供前端新增/修改/查询菜品，也供 Agent 在需要时查询菜品信息。
- 提供推荐接口，供前端提交预算金额、人数和成员约束并获取推荐菜品组合。
- 提供 API-Agent 推荐编排契约：API 调用 Agent 服务生成推荐组合，Agent 返回菜品 ID、数量、总价、理由和冲突说明。
- API 负责校验 Agent 返回结果，并写入 `recommendation_sessions` / `recommendation_items`。
- 提供推荐结果查询接口，供前端展示或轮询历史推荐结果。
- 预留图片识别挑战能力：上传图片、识别候选菜品、人工确认后入库。
- 维护本地 Docker 部署拓扑：Postgres、migrate、API 服务均在容器中运行。
- 提供 API 契约，供 RFC-0003 前端或 Agent 服务适配。

#### 首期非目标

- 不实现或维护 Next.js 前端页面、路由、状态管理和 UI 交互。
- 不实现或维护 Agent 内部 prompt、LLM 运行时、自然语言解释和工具编排细节。
- 不允许 Agent 直接修改正式菜单表；Agent 只返回推荐组合，正式 CRUD 和落库由 API 维护。
- 不实现支付、优惠券、复杂会员体系或生产级权限系统。
- 不把 OCR 自动识别作为基础能力，也不承诺图片识别完全准确。
- 不让前端或 Agent 直接连接 Postgres。
- 不在首期实现复杂多目标优化器；首期推荐以可行性和可解释性为主。

### 当前假设

- 本地演示环境，不需要生产级认证。
- 前端使用 Next.js，但由 RFC-0003 维护；本 RFC 只提供 API 契约。
- 后端接口服务采用 Node.js/JavaScript API 服务。
- 本地验证和部署时，Postgres、migrate 与 API 服务均运行在 Docker 容器中。
- 前端通过 API 新增/修改菜品，并通过 API 提交预算金额获取推荐菜品组合。
- API 在推荐接口中调用 Agent 服务获取推荐组合，Agent 需要查询菜品时也只调用 API。
- 前端和 Agent 服务通过 API 服务访问数据库，而不是由前端或 Agent 直接操作数据库。
- 图片识别先走候选表，再人工确认入库。

### 本地部署拓扑

本地验证和部署使用 `docker compose` 管理基础设施、迁移任务和接口服务；前端或 Agent 如需要联调，只通过宿主机暴露的 API 端口访问。

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ordering
      POSTGRES_PASSWORD: ordering
      POSTGRES_DB: ordering
    ports:
      - "55432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  migrate:
    build:
      context: ../apps/api
      dockerfile: Dockerfile
    command: ["npm", "run", "db:migrate"]
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://ordering:ordering@postgres:5432/ordering

  api:
    build:
      context: ../apps/api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      DATABASE_URL: postgres://ordering:ordering@postgres:5432/ordering
      PORT: "3001"

volumes:
  pgdata:
```

建议运行方式：

- `docker compose -f docker/compose.yaml up postgres migrate api`：启动数据库、迁移任务和接口服务。
- 前端或 Agent 联调时访问 `http://localhost:3001`。
- 如需宿主机调试数据库，可使用 `localhost:55432` 连接容器内 Postgres。

### 关键设计决策

#### 1. API 服务作为唯一数据访问与落库边界

前端和 Agent 都通过 API 服务访问数据。API 服务负责校验、事务、推荐编排、Agent 服务调用和数据库访问，避免前端或 Agent 直接操作 Postgres。

理由：

- 前端只需维护用户交互，不承担数据库连接配置；RFC-0002 只向它暴露 API 契约。
- Agent 服务只需根据 API 传入的菜单上下文和约束生成推荐组合；推荐结果由 API 落库。
- 推荐编排集中在 API 服务中，便于控制 Agent 调用、校验返回结果、记录历史和统一错误处理。

#### 2. 价格使用 `price_cents` 整数存储

菜品价格使用分（cents）作为整数存储，例如 48 元存为 `4800`。

理由：

- 避免浮点数精度问题。
- 推荐总价、预算校验和金额计算更稳定。
- 后续扩展支付或优惠时不需要迁移价格字段。

#### 3. 标签与食材拆分建模

菜品标签通过 `tags` + `menu_item_tags` 建模；食材通过 `menu_item_ingredients` 建模，并保留 `confidence`。

理由：

- 标签用于分类、辣度、过敏原、菜系等可枚举或半结构化信息。
- 食材用于过敏/忌口等硬约束校验。
- `confidence` 为图片识别或 LLM 推断结果提供可信度字段，后续可支持人工校正。

#### 4. 图片识别结果先进入候选表

图片识别挑战能力不直接写入 `menu_items`，而是写入 `menu_item_candidates`，由用户确认后再提升到正式菜品表。

理由：

- 图片 OCR/视觉识别可能误识别菜名、价格或标签。
- 人工确认能避免错误菜单污染推荐链路。
- 候选表保留 `source_image_id` 和 `confidence`，便于调试和后续优化。

#### 5. 推荐编排与 Agent 服务解耦

推荐请求由 API 服务接收，API 可根据配置或请求参数选择本地推荐逻辑或 Agent 服务。前端只调用 API 的推荐接口，不直接调用 Agent；Agent 服务只返回推荐组合，不直接写入数据库。

理由：

- 前端 Demo 不依赖 Agent 在线即可验证推荐接口。
- API 可以统一处理预算校验、Agent 超时、返回格式校验和推荐结果落库。
- Agent 可以在需要时通过 API 查询菜品信息，保持菜单数据边界一致。
- 后续替换推荐算法或 Agent 服务时，前端和 Agent 的接口契约保持稳定。

### 数据模型

#### 核心表

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
  image_url TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('ingredient', 'allergen', 'cuisine', 'spicy', 'diet', 'other')),
  description TEXT
);

CREATE TABLE menu_item_tags (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, tag_id)
);

CREATE TABLE menu_item_ingredients (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (menu_item_id, ingredient)
);

CREATE TABLE recommendation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_cents INTEGER NOT NULL CHECK (budget_cents > 0),
  person_count INTEGER NOT NULL CHECK (person_count > 0),
  member_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_items (
  session_id UUID NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  PRIMARY KEY (session_id, menu_item_id)
);
```

#### 图片识别挑战能力扩展表

```sql
CREATE TABLE menu_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'vision')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_item_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_image_id UUID REFERENCES menu_images(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 索引

```sql
CREATE INDEX idx_menu_items_active_price ON menu_items(status, price_cents);
CREATE INDEX idx_menu_item_tags_tag_id ON menu_item_tags(tag_id, menu_item_id);
CREATE INDEX idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient);
CREATE INDEX idx_recommendation_sessions_created_at ON recommendation_sessions(created_at DESC);
CREATE INDEX idx_menu_items_name_fts ON menu_items USING gin (to_tsvector('simple', name));
```

#### 更新时间触发器

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
```

### 接口契约

#### 菜品 CRUD

| 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/menu-items` | 查询菜品列表，支持分页、关键词、分类、状态过滤 |
| `POST` | `/api/menu-items` | 新增菜品 |
| `PATCH` | `/api/menu-items/:id` | 修改菜品 |
| `DELETE` | `/api/menu-items/:id` | 删除/下架菜品 |

新增菜品请求示例：

```json
{
  "name": "招牌牛肉饭",
  "description": "牛肉 + 米饭",
  "price_cents": 4800,
  "category": "主食",
  "tags": ["牛肉", "辣度:中"],
  "ingredients": ["牛肉", "米饭"],
  "attributes": {
    "spicy_level": "medium",
    "cuisine": "中式"
  }
}
```

#### 推荐接口

| 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/recommendations` | 生成推荐方案 |
| `GET` | `/api/recommendations/:id` | 查询推荐结果 |

推荐请求示例：

```json
{
  "budget_cents": 25000,
  "person_count": 5,
  "member_constraints": [
    {
      "member_id": "A",
      "allergies": ["peanut"],
      "spicy_tolerance": "none"
    },
    {
      "member_id": "B",
      "dislikes": ["pork"],
      "spicy_tolerance": "mild"
    }
  ],
  "engine": "agent"
}
```

`engine` 表示推荐生成方式：

- `local`：API 使用内置推荐逻辑生成组合。
- `agent`：API 调用 Agent 服务生成组合，再由 API 校验并落库。

推荐响应示例：

```json
{
  "session_id": "uuid",
  "status": "completed",
  "total_price_cents": 23200,
  "remaining_budget_cents": 1800,
  "items": [
    {
      "menu_item_id": "uuid",
      "name": "番茄鸡蛋饭",
      "quantity": 1,
      "unit_price_cents": 2800,
      "subtotal_cents": 2800
    }
  ],
  "reasons": [
    "总价未超过预算",
    "避开花生过敏",
    "满足不吃辣限制"
  ],
  "conflicts": []
}
```

#### API-Agent 推荐编排契约

当 `POST /api/recommendations` 使用 `engine: "agent"` 时，API 调用 Agent 服务获取推荐组合。Agent 服务由外部维护，API 只约定结构化输入输出，并负责最终落库。

Agent 请求示例：

```json
{
  "budget_cents": 25000,
  "person_count": 5,
  "member_constraints": [
    {
      "member_id": "A",
      "allergies": ["peanut"],
      "spicy_tolerance": "none"
    }
  ],
  "menu_items": [
    {
      "id": "uuid",
      "name": "番茄鸡蛋饭",
      "price_cents": 2800,
      "category": "主食",
      "attributes": {
        "spicy_level": "none"
      },
      "ingredients": ["鸡蛋", "番茄", "米饭"]
    }
  ]
}
```

Agent 响应示例：

```json
{
  "total_price_cents": 23200,
  "items": [
    {
      "menu_item_id": "uuid",
      "quantity": 1,
      "unit_price_cents": 2800,
      "subtotal_cents": 2800
    }
  ],
  "reasons": [
    "总价未超过预算",
    "避开花生过敏"
  ],
  "conflicts": []
}
```

API 收到 Agent 响应后必须执行以下校验：

1. 总价不超过请求预算。
2. 推荐菜品 ID 均存在于当前 `menu_items`。
3. 每个 `unit_price_cents` 与当前菜品价格一致，或记录快照价格。
4. 返回字段类型合法，`items` 不为空。
5. 校验失败时将推荐会话标记为 `failed`，并返回明确错误给前端。

#### 图片识别挑战能力接口

| 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/menu-images` | 上传菜单图片 |
| `POST` | `/api/menu-images/:id/recognize` | 触发图片识别 |
| `POST` | `/api/menu-items/from-candidates` | 将候选菜品确认入库 |

### 推荐流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端 / RFC-0003
    participant API as 接口服务
    participant AG as Agent 服务
    participant DB as Postgres

    U->>FE: 输入预算、人数、成员约束
    FE->>API: POST /api/recommendations
    API->>DB: 读取 active 菜品与标签
    API->>AG: 调用 Agent 服务生成推荐组合
    AG->>API: 可选：GET /api/menu-items 查询菜品信息
    API-->>AG: 返回菜品信息
    AG-->>API: 返回推荐组合、总价、理由和冲突
    API->>DB: 写入 recommendation_sessions / recommendation_items
    API-->>FE: 返回推荐方案
    FE-->>U: 展示或解释总价、菜品、理由
```

推荐策略：

1. 前端提交预算金额、人数和成员约束到 API。
2. API 读取 `active` 菜品，并调用 Agent 服务生成推荐组合。
3. Agent 可在需要时通过 API 查询菜品信息，但不直接访问数据库。
4. API 校验 Agent 返回的菜品 ID、价格、数量和总价。
5. API 将推荐结果写入 `recommendation_sessions` / `recommendation_items`。
6. API 返回前端可展示的推荐方案、理由和冲突说明。

### 图片识别挑战能力设计

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端 / Agent 调用方
    participant API as 接口服务
    participant IMG as 图片识别模块
    participant DB as Postgres

    U->>FE: 上传菜单图片
    FE->>API: POST /api/menu-images
    API->>DB: 保存 menu_images
    API->>IMG: 触发识别
    IMG->>DB: 写入 menu_item_candidates
    API-->>FE: 返回候选列表
    U->>FE: 人工确认/修改
    FE->>API: POST /api/menu-items/from-candidates
    API->>DB: 提升到 menu_items
```

扩展说明：

- MVP 阶段不要求自动 OCR 完全准确。
- 图片识别结果先进入 `menu_item_candidates`，再由人工确认。
- 后续可接入 NexAU `read_visual_file` 或独立 OCR 服务。

### 架构图

```mermaid
flowchart LR
    subgraph Caller["外部调用方"]
        FE["前端 RFC-0003"]
        AG["Agent 服务"]
    end

    subgraph API["apps/api"]
        MenuAPI["菜品 CRUD API"]
        RecAPI["推荐 API"]
        RecOrch["推荐编排 / Agent 调用"]
        ImageAPI["图片上传/识别 API"]
        CandidateAPI["候选确认 API"]
        DBAccess["数据库访问层"]
    end

    subgraph Docker["docker/"]
        Migrate["migrate 容器"]
        Postgres["Postgres 容器"]
    end

    subgraph DB["Postgres schema"]
        MenuItem["menu_items"]
        Tags["tags / menu_item_tags"]
        Ingredients["menu_item_ingredients"]
        Sessions["recommendation_sessions / items"]
        Images["menu_images"]
        Candidates["menu_item_candidates"]
    end

    FE -->|新增/修改菜品| MenuAPI
    FE -->|提交预算获取推荐| RecAPI
    RecAPI --> RecOrch
    RecOrch -->|生成推荐组合| AG
    AG -->|查询菜品信息| MenuAPI
    MenuAPI --> DBAccess --> MenuItem
    MenuAPI --> DBAccess --> Tags
    MenuAPI --> DBAccess --> Ingredients
    RecOrch --> DBAccess --> MenuItem
    RecOrch --> Sessions
    ImageAPI --> DBAccess --> Images
    CandidateAPI --> DBAccess --> Candidates
    Migrate --> Postgres
    API --> Postgres
```

## 权衡取舍

### 考虑过的替代方案

| 方案 | 优点 | 缺点 | 决定 |
| --- | --- | --- | --- |
| 前端直连 Postgres | 实现最少，少一层服务 | 暴露数据库连接，权限和部署复杂，不适合 Agent 服务复用 | 不采用 |
| 前端直接调用 Agent | 前端可拿到更灵活的推荐解释 | 暴露 LLM 配置、超时和错误处理，且无法保证统一落库 | 不采用 |
| Agent 直接读写数据库 | Agent 能力更强，调用路径短 | Agent 误操作风险高，推荐逻辑难以独立测试，违反统一落库边界 | 不采用 |
| API 服务作为数据访问与落库边界 | 职责清晰，前端和 Agent 可复用接口，推荐结果可统一落库 | 多一个服务层，本地启动步骤略多 | 采用 |
| API 调用 Agent 生成推荐组合 | 复用 Agent 能力，前端仍只依赖稳定 API | 需要处理 Agent 超时、返回格式校验和降级策略 | 采用 |
| 图片识别直接入库 | 自动化程度高，流程短 | OCR 错误会污染正式菜单和推荐结果 | 不采用 |
| 图片识别先入候选表 | 可人工确认，错误可隔离，便于调试 | 多一步确认流程 | 采用 |

### 缺点

- RFC-0002 本身需要同时运行 Postgres、migrate 和 API 服务，启动步骤比单文件 Demo 复杂。
- 前端和 Agent 如要联调，需要额外适配 RFC-0002 的 API 契约。
- API 服务增加了一层抽象，首期实现成本高于纯脚本方案。
- 标签和食材拆分建模比单字段 JSON 更复杂，但可测试性和约束校验能力更好。
- 图片识别挑战能力需要候选确认流程，不能承诺全自动准确入库。

## 实现计划

### 阶段划分

1. **阶段一：确认 API、数据库和 Docker 部署边界**
   - 明确 RFC-0002 只维护 `apps/api`、数据库 schema/迁移脚本和 `docker/` 本地部署拓扑。
   - 明确前端通过 API 新增/修改菜品和提交预算金额获取推荐组合；Agent 服务只通过 API 查询菜品信息并返回推荐组合。
   - 明确前端页面和 Agent 内部运行时不由 RFC-0002 实现。
   - 确定 Docker 中 Postgres、migrate、API 的运行方式和环境变量。

2. **阶段二：数据库 schema 与迁移脚本**
   - 实现菜品、标签、食材、推荐会话、推荐明细、图片候选表。
   - 添加索引和更新时间触发器。

3. **阶段三：接口服务基础能力**
   - 实现菜品 CRUD、推荐接口、API-Agent 推荐编排契约和图片候选接口。
   - 将推荐编排与数据库访问层解耦，API 负责调用 Agent、校验返回结果和落库。

4. **阶段四：API/数据库验证与文档**
   - 补充数据库迁移测试、推荐编排测试、Agent contract mock 测试和接口测试。
   - 编写 Docker 启动说明、API 契约说明、API-Agent 契约说明和数据库表说明。
   - 前端页面实现和 Agent 内部运行时联调属于外部调用方适配，不阻塞 RFC-0002 的 API/DB 验收。

### 子任务分解

#### 依赖关系图

```mermaid
graph TD
    T1["T1 API、数据库和 Docker 部署边界"]
    T2["T2 数据库 schema 与迁移"]
    T3["T3 接口服务基础能力"]
    T4["T4 API/数据库验证与文档"]

    T1 --> T2
    T2 --> T3
    T3 --> T4
```

#### 子任务列表

| ID | 标题 | 依赖 | Ref |
| --- | --- | --- | --- |
| T1 | 确认 API、数据库和 Docker 部署边界 | 无 |  |
| T2 | 实现数据库 schema 与迁移脚本 | T1 |  |
| T3 | 实现接口服务基础能力 | T2 |  |
| T4 | 补充 API/数据库验证、测试与 Docker 启动说明 | T3 |  |

> 说明：前端页面实现和 Agent 内部 prompt/运行时不属于 RFC-0002 范围。前端 Demo 由 RFC-0003 维护；Agent 服务作为推荐组合生成方，只通过 API 查询菜品信息并返回结构化推荐结果。

#### 子任务定义

##### T1 确认 API、数据库和 Docker 部署边界

范围：

- 创建或确认 `apps/api/`、数据库 schema/迁移脚本、`docker/` 目录。
- 明确前端通过 API 访问菜品和推荐，Agent 通过 API 查询菜品信息，均不直接连接 Postgres。
- 明确 API-Agent 推荐编排契约：API 调用 Agent 获取推荐组合，Agent 不写数据库。
- 定义 Docker Compose 中 Postgres、migrate、API 的环境变量和依赖关系。

验收标准：

- 本地项目结构清晰，职责边界明确。
- `docker compose` 能启动 Postgres、migrate 和 API 服务。
- README 或 RFC 能说明本地启动方式和 API 访问地址。

##### T2 实现数据库 schema 与迁移脚本

范围：

- 实现 `menu_items`、`tags`、`menu_item_tags`、`menu_item_ingredients`。
- 实现 `recommendation_sessions`、`recommendation_items`。
- 实现图片识别挑战能力所需的 `menu_images`、`menu_item_candidates`。
- 添加索引和更新时间触发器。

验收标准：

- 迁移脚本可在空 Postgres 数据库中执行成功。
- 菜品、标签、食材、推荐结果、图片候选表均可正常读写。
- 价格字段使用整数分存储。

##### T3 实现接口服务基础能力

范围：

- 实现菜品 CRUD API。
- 实现推荐接口，包含预算、人数、过敏、忌口、辣度等约束校验。
- 实现 API-Agent 推荐编排契约：API 调用 Agent 服务生成推荐组合，校验后写入推荐会话和推荐明细。
- 实现图片上传、识别触发、候选确认入库接口。

验收标准：

- API 调用方可通过 REST API 新增、修改、查询菜品。
- 推荐接口能返回总价、剩余预算、菜品列表、理由说明和冲突说明。
- API 可通过 Agent 服务获取推荐组合，并完成校验和落库。
- 图片识别接口不直接污染正式菜单表。

##### T4 补充 API/数据库验证、测试与 Docker 启动说明

范围：

- 补充数据库迁移测试、推荐编排测试、Agent contract mock 测试和接口测试。
- 编写本地 Docker、Postgres、migrate、接口服务的启动说明。
- 记录 API 契约、API-Agent 契约、数据库表和候选确认流程。

验收标准：

- 本地可通过 Docker Compose 启动数据库、迁移任务和接口服务。
- API 单元测试、接口测试和 API-Agent contract mock 测试可通过。
- API 调用方可根据文档完成菜单 CRUD、推荐和图片候选确认流程。
- 前端页面实现和 Agent 内部运行时联调不作为 RFC-0002 的必需验收项，但必须验证 API-Agent 推荐契约。

### 影响范围

预期新增或修改：

- `apps/api/`：接口服务、推荐引擎、数据库访问层。
- `apps/api/database/`：Postgres schema 与迁移脚本。
- `docker/`：Postgres、migrate 与 API 服务本地部署配置。
- `docs/rfcs/0002-ordering-system-architecture.md`：本 RFC。
- `docs/rfcs/meta/0002-ordering-system-architecture.json`：RFC 元数据。

预期外部依赖：

- Postgres 16。
- Docker / Docker Compose。
- Node.js API 服务。
- 前端 RFC-0003 或 Agent 服务作为 API 调用方，可选联调，不由 RFC-0002 实现。

## 测试方案

### 单元测试

- 数据库 schema：
  - 迁移脚本可在空库执行。
  - 价格字段使用 `price_cents` 整数存储。
  - 标签、食材、推荐会话、图片候选表结构符合设计。
- 推荐引擎：
  - 总价不超过预算。
  - 过敏菜品被拒绝。
  - 忌口菜品被拒绝。
  - 辣度超出容忍范围被拒绝。
  - 预算不足时返回冲突说明。
- 图片候选：
  - 识别候选进入 `menu_item_candidates`。
  - 人工确认后进入 `menu_items`。
  - 拒绝候选不会污染正式菜单。

### 集成测试

- 使用 API 或迁移/种子脚本新增 10 个以上菜品。
- 使用 5 人、250 元预算、A/B/C 成员约束调用推荐接口并验证结果。
- 使用一张菜单图片触发图片候选流程，验证候选表与人工确认流程。
- 可选：由 RFC-0003 前端或 Agent 服务调用同一 API 契约进行联调，不作为 RFC-0002 必需验收。

### 手动验证

启动本地环境后执行：

1. `docker compose -f docker/compose.yaml up postgres migrate api`
2. 通过 API 或种子脚本新增/导入 Demo 菜品。
3. 调用推荐接口，输入预算、人数、成员约束。
4. 检查推荐结果包含总价、菜品列表和理由说明。
5. 上传菜单图片并确认候选菜品不会绕过人工确认。
6. 如需联调，由前端 RFC-0003 或 Agent 服务访问 `http://localhost:3001` 调用同一 API 契约。

## 未解决的问题

无。首期范围已调整为 RFC-0002 只维护接口服务、数据库表和 Docker 部署；前端页面由 RFC-0003 维护，Agent 服务作为推荐组合生成方和 API 调用方。

## 参考资料

- RFC-0001：NexAU 多人点餐推荐 Agent
- Hackathon 参赛说明：TOPIC B 点餐系统
- 飞书文档：North Hackathon 第4弹参赛说明
