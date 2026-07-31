# RFC-0002 API 契约说明

本文档记录点餐系统 API 服务对外暴露的 REST 契约，供 RFC-0003 前端、Agent 服务或手工验证脚本调用。API 服务是本 RFC 的唯一数据库写入边界，调用方不应直接连接 Postgres。

## 通用约定

- 基础地址：`http://localhost:3001`
- JSON 请求需设置 `Content-Type: application/json`
- 金额统一使用分（cents）作为整数，例如 `4800` 表示 48.00 元
- 错误响应统一为：

```json
{
  "error": "错误消息",
  "details": {}
}
```

## 健康检查

```http
GET /
```

返回：

```json
{
  "service": "ordering-api",
  "status": "ok",
  "rfc": "RFC-0002",
  "endpoints": []
}
```

## 菜品 CRUD

### 查询菜品列表

```http
GET /api/menu-items?keyword=&category=&status=active&page=1&page_size=20
```

返回：

```json
{
  "page": 1,
  "page_size": 20,
  "total": 1,
  "items": [
    {
      "id": "uuid",
      "name": "番茄鸡蛋饭",
      "description": "鸡蛋 + 番茄 + 米饭",
      "price_cents": 2800,
      "category": "主食",
      "status": "active",
      "image_url": null,
      "attributes": {
        "spicy_level": "none"
      },
      "tags": ["辣度:无"],
      "ingredients": ["鸡蛋", "番茄", "米饭"],
      "created_at": "2026-07-31T00:00:00.000Z",
      "updated_at": "2026-07-31T00:00:00.000Z"
    }
  ]
}
```

### 新增菜品

```http
POST /api/menu-items
```

请求：

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

返回：

```json
{
  "id": "uuid",
  "name": "招牌牛肉饭",
  "description": "牛肉 + 米饭",
  "price_cents": 4800,
  "category": "主食",
  "status": "active",
  "image_url": null,
  "attributes": {
    "spicy_level": "medium",
    "cuisine": "中式"
  },
  "tags": ["牛肉", "辣度:中"],
  "ingredients": ["牛肉", "米饭"],
  "created_at": "2026-07-31T00:00:00.000Z",
  "updated_at": "2026-07-31T00:00:00.000Z"
}
```

### 查询单个菜品

```http
GET /api/menu-items/:id
```

返回单个菜品对象，字段与新增菜品响应一致。

### 修改菜品

```http
PATCH /api/menu-items/:id
```

请求：

```json
{
  "name": "招牌牛肉饭（辣）",
  "price_cents": 5200,
  "tags": ["牛肉", "辣度:高"],
  "ingredients": ["牛肉", "米饭", "辣椒"]
}
```

返回更新后的菜品对象。

### 删除菜品

```http
DELETE /api/menu-items/:id
```

返回：

```json
{
  "id": "uuid",
  "deleted": true
}
```

## 推荐接口

### 生成推荐方案

```http
POST /api/recommendations
```

请求：

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
  "engine": "local"
}
```

返回：

```json
{
  "session_id": "uuid",
  "status": "completed",
  "total_price_cents": 23200,
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
    "已避开成员声明的过敏食材或标签"
  ],
  "conflicts": []
}
```

### 查询推荐结果

```http
GET /api/recommendations/:id
```

返回：

```json
{
  "session_id": "uuid",
  "status": "completed",
  "total_price_cents": 23200,
  "items": [
    {
      "menu_item_id": "uuid",
      "name": "番茄鸡蛋饭",
      "quantity": 1,
      "unit_price_cents": 2800,
      "subtotal_cents": 2800
    }
  ],
  "reasons": ["总价未超过预算"]
}
```

## 图片候选接口

### 保存菜单图片

```http
POST /api/menu-images
```

请求：

```json
{
  "file_name": "menu.jpg",
  "storage_path": "local/menu.jpg",
  "mime_type": "image/jpeg",
  "source": "manual"
}
```

返回：

```json
{
  "id": "uuid",
  "file_name": "menu.jpg",
  "storage_path": "local/menu.jpg",
  "mime_type": "image/jpeg",
  "source": "manual",
  "status": "pending",
  "raw_response": {},
  "created_at": "2026-07-31T00:00:00.000Z"
}
```

### 触发图片识别候选

```http
POST /api/menu-images/:id/recognize
```

请求：

```json
{
  "candidates": [
    {
      "name": "番茄鸡蛋饭",
      "description": "鸡蛋 + 番茄 + 米饭",
      "price_cents": 2800,
      "tags": ["辣度:无"],
      "ingredients": ["鸡蛋", "番茄", "米饭"],
      "attributes": {
        "spicy_level": "none"
      },
      "confidence": 0.92
    }
  ],
  "recognition": {
    "provider": "manual-mock",
    "raw": {}
  }
}
```

返回：

```json
{
  "image_id": "uuid",
  "status": "processed",
  "candidate_count": 1
}
```

### 确认候选入库

```http
POST /api/menu-items/from-candidates
```

请求：

```json
{
  "candidate_ids": ["uuid"]
}
```

返回：

```json
{
  "accepted_count": 1,
  "items": [
    {
      "id": "uuid",
      "name": "番茄鸡蛋饭",
      "price_cents": 2800,
      "status": "active",
      "attributes": {
        "spicy_level": "none"
      },
      "tags": ["辣度:无"],
      "ingredients": ["鸡蛋", "番茄", "米饭"]
    }
  ]
}
```

## 本地验证命令

```bash
cd apps/api
npm test
```

测试覆盖：

- `database/schema.test.js`：验证 RFC-0002 schema 表、字段、约束、索引和更新时间触发器。
- `src/recommendation.test.js`：验证推荐引擎预算、过敏、忌口、辣度约束。
- `src/agent-contract.test.js`：验证 API-Agent 推荐编排输入输出契约。
- `src/server.test.js` 与 `src/route.test.js`：验证 API 服务导出和关键路由行为。
