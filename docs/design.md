# LLM Memory Chat — 详细设计文档

## 1. 系统架构

### 1.1 技术选型

| 层 | 技术选型 | 选型理由 |
|----|----------|----------|
| 后端框架 | Python 3.13 + FastAPI | 异步支持好，自动 OpenAPI 文档，生态成熟 |
| ORM & 迁移 | SQLAlchemy + Alembic | Python ORM 事实标准，Alembic 迁移管理可靠 |
| 前端框架 | React 19 + TypeScript + Vite + Ant Design | 组件化开发，类型安全，Vite 构建快 |
| 数据库 | SQLite（开发默认）/ PostgreSQL（生产推荐） | 零配置开发，PostgreSQL 支持 pgvector |
| LLM 接入 | OpenAI 兼容 API | 兼容通义千问、Kimi、MiniMax、GLM 等国内主流模型 |
| 向量检索 | pgvector（PostgreSQL 扩展，可选） | 原生 SQL 集成，无需额外服务 |

### 1.2 整体架构

系统采用前后端分离的单体架构：

```
用户浏览器
  |
  +-- React SPA (Vite dev server :5173)
  |
  +-- FastAPI 后端 (:8000)
       |
       +-- SQLAlchemy ORM
       |    |
       |    +-- SQLite / PostgreSQL
       |
       +-- OpenAI 兼容 API
            |
            +-- LLM 服务（通义千问 / Kimi / MiniMax / GLM 等）
```

### 1.3 后端分层

```
routers/          -- API 路由层：参数校验、认证、HTTP 响应
  |
  +-- services/   -- 业务逻辑层：核心处理逻辑
       |
       +-- models.py / database.py  -- 数据访问层
```

路由层只负责 HTTP 协议相关逻辑（解析请求、返回响应），所有业务逻辑下沉到 service 模块。Service 之间可以互相调用。

当前后端模块划分：

| 路由模块 | 对应服务 | 说明 |
|----------|----------|------|
| routers/auth | services/auth_service | 认证与会话管理 |
| routers/chat | services/llm_service, services/memory_* | 主聊天端点 |
| routers/chat_v1 | services/llm_service, services/memory_* | V1 开发者端点 |
| routers/conversations | services/conversation_memory_service | 对话管理 |
| routers/memories | services/memory_service | 记忆 CRUD |
| routers/memory_candidates | services/memory_candidate_service | 记忆候选管理 |
| routers/memory_documents | services/memory_document_service | 记忆文档管理 |
| routers/projects | services/project_service | 项目管理 |
| routers/attachments | services/attachment_service | 附件管理 |
| routers/audit | services/memory_audit_service | 审计日志查询 |
| routers/debug | — | API 调试器 |
| routers/debug_history | — | 调试历史管理 |

### 1.4 前端结构

```
App.tsx                    -- 全局状态管理 + 路由
  |
  +-- components/
  |    +-- Sidebar.tsx              -- 侧边栏（对话列表、项目列表）
  |    +-- ChatWindow.tsx           -- 聊天主窗口
  |    +-- ChatInput.tsx            -- 消息输入框
  |    +-- InlineMemoryCandidate.tsx     -- 内联记忆候选卡片
  |    +-- ModelPickerPopover.tsx        -- 模型选择器
  |    +-- ProjectFormDialog.tsx         -- 项目创建/编辑弹窗
  |    +-- ProjectGroup.tsx              -- 项目分组组件
  |    +-- AppMessageProvider.tsx        -- 全局消息 Provider
  |    +-- MessageProvider.tsx           -- 消息处理 Provider
  |    +-- MemorySettingsSection.tsx     -- 记忆设置区域
  |    +-- Icons.tsx                     -- 图标组件
  |    +-- SignUpScreen.tsx              -- 注册/登录界面
  |    +-- settings/                     -- 设置面板
  |    |    +-- SettingsCenter.tsx           -- 设置中心
  |    |    +-- AccountSettingsPanel.tsx     -- 账号设置
  |    |    +-- DataSettingsPanel.tsx        -- 数据管理
  |    |    +-- GeneralSettingsPanel.tsx     -- 通用设置
  |    |    +-- MemorySettingsPanel.tsx      -- 记忆设置
  |    |    +-- MemoryDocumentSection.tsx    -- 记忆文档区域
  |    +-- api-explorer/             -- API 调试器
  |         +-- ParamsPanel.tsx          -- 参数面板
  |         +-- MessagesEditor.tsx       -- 消息编辑器
  |         +-- ActionBar.tsx            -- 操作栏
  |         +-- DebugResultsTab.tsx      -- 调试结果
  |         +-- DocsTab.tsx              -- 文档标签
  |         +-- HistoryTab.tsx           -- 历史记录
  |         +-- SDKExamplesTab.tsx       -- SDK 示例
  |         +-- TabPanel.tsx             -- 标签面板
  |
  +-- pages/
  |    +-- APIExplorerPage.tsx       -- API 调试器页面
  |
  +-- services/
  |    +-- api.ts                -- 后端 API 调用封装
  |    +-- message.ts            -- 消息/toast 服务
  |
  +-- types.ts                   -- TypeScript 类型定义
```

---

## 2. 数据模型设计

### 2.1 ER 关系概览

```
User 1--N Conversation 1--N Message 1--N Attachment
  |
  +-- 1--N Project 1--N Conversation
  |
  +-- 1--N Memory
  |     |
  |     +-- N--1 Project (可选)
  |     +-- N--1 Conversation (可选)
  |     +-- 1--1 MemoryEmbedding
  |     +-- 1--N MemoryHistory
  |     +-- 1--N MemoryAuditLog
  |
  +-- 1--N MemoryCandidate
  |     |
  |     +-- N--1 Memory (target / accepted)
  |
  +-- 1--N MemoryDocument
  |
  +-- 1--N UserSession
  |
  +-- 1--N ApiDebugHistory
```

### 2.2 核心表结构

#### users

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| email | String(255) | UNIQUE, INDEX | 用户邮箱 |
| password_hash | String(255) | NOT NULL | bcrypt 哈希 |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

#### projects

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, INDEX | 所属用户 |
| name | String(120) | NOT NULL | 项目名称 |
| description | Text | NULLABLE | 项目描述 |
| default_model | String(100) | NULLABLE | 项目默认模型 |
| default_reasoning_level | String(20) | NULLABLE | 项目默认推理等级 |
| is_default | Boolean | DEFAULT false | 是否为默认项目 |
| archived_at | DateTime(tz) | NULLABLE | 归档时间（软删除） |
| created_at / updated_at | DateTime(tz) | NOT NULL | 时间戳 |

#### conversations

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, NULLABLE | 所属用户（匿名为 null） |
| project_id | String(32) | FK → projects, NULLABLE, ON DELETE SET NULL | 所属项目 |
| title | String(200) | DEFAULT "新对话" | 对话标题 |
| pinned | Boolean | DEFAULT false | 是否置顶 |
| created_at / updated_at | DateTime(tz) | NOT NULL | 时间戳 |

#### messages

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| conversation_id | String(32) | FK → conversations, ON DELETE CASCADE | 所属对话 |
| role | String(20) | NOT NULL | user / assistant / system |
| content | Text | NOT NULL | 消息内容 |
| model | String(100) | NULLABLE | 使用的模型 ID |
| parent_message_id | String(32) | FK → messages, NULLABLE, ON DELETE SET NULL | 父消息（版本链） |
| version_number | Integer | DEFAULT 1 | 版本号 |
| is_current | Boolean | DEFAULT true, INDEX | 是否为当前版本 |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

消息版本通过 parent_message_id 形成链式关系。同一 parent 下的多个 assistant 消息构成版本列表，is_current 标记当前生效版本。

#### memories

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, INDEX | 所属用户 |
| project_id | String(32) | FK → projects, NULLABLE, INDEX | 所属项目 |
| conversation_id | String(32) | FK → conversations, NULLABLE, INDEX | 所属对话 |
| content | Text | NOT NULL | 记忆内容 |
| kind | String(40) | DEFAULT "fact" | 分类：fact/preference/project/tool/decision |
| scope | String(20) | DEFAULT "global" | 作用域：global/project/conversation |
| status | String(20) | DEFAULT "active" | 状态：active/archived |
| importance | Integer | DEFAULT 0 | 重要度 0-100 |
| enabled | Boolean | DEFAULT true | 是否启用 |
| source_message_id | String(32) | FK → messages, NULLABLE | 来源消息 |
| superseded_by_id | String(32) | FK → memories, NULLABLE | 被哪条记忆替代 |
| source_candidate_id | String(32) | FK → memory_candidates, NULLABLE | 来源候选 |
| last_used_at | DateTime(tz) | NULLABLE | 最后使用时间 |
| archived_at | DateTime(tz) | NULLABLE | 归档时间 |
| created_at / updated_at | DateTime(tz) | NOT NULL | 时间戳 |

#### memory_candidates

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, INDEX | 所属用户 |
| project_id | String(32) | FK → projects, NULLABLE, INDEX | 目标项目 |
| conversation_id | String(32) | FK → conversations, NULLABLE, INDEX | 目标对话 |
| scope | String(20) | DEFAULT "global", INDEX | 作用域 |
| action | String(20) | DEFAULT "create", INDEX | 操作：create/update/archive |
| content | Text | NOT NULL | 候选记忆内容 |
| kind | String(40) | DEFAULT "fact" | 分类 |
| confidence | Integer | DEFAULT 0 | 置信度 0-100 |
| importance | Integer | DEFAULT 0 | 重要度 0-100 |
| reason | Text | DEFAULT "" | 提取原因 |
| status | String(20) | DEFAULT "pending", INDEX | pending/accepted/dismissed |
| surface | String(40) | DEFAULT "settings", INDEX | 展示位置：inline/settings |
| target_memory_id | String(32) | FK → memories, NULLABLE | update/archive 的目标记忆 |
| accepted_memory_id | String(32) | FK → memories, NULLABLE | 接受后生成的记忆 |
| extraction_model | String(100) | NULLABLE | 提取时使用的模型 |
| presented_at / reviewed_at | DateTime(tz) | NULLABLE | 展示/审核时间 |
| created_at / updated_at | DateTime(tz) | NOT NULL | 时间戳 |

#### memory_documents

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, INDEX | 所属用户 |
| project_id / conversation_id | String(32) | FK, NULLABLE, INDEX | 作用域关联 |
| scope | String(20) | DEFAULT "global", INDEX | 作用域 |
| content_md | Text | NOT NULL | Markdown 格式的记忆文档 |
| source_memory_ids | Text | DEFAULT "" | 来源记忆 ID 列表 |
| revision | Integer | DEFAULT 1 | 文档版本号 |
| is_stale | Boolean | DEFAULT false | 是否需要重新生成 |
| generated_by | String(20) | DEFAULT "fallback" | 生成方式：ai/fallback |
| generation_model | String(100) | NULLABLE | 生成时使用的模型 |
| generation_error | Text | NULLABLE | 生成错误信息 |
| generated_at | DateTime(tz) | NULLABLE | 生成时间 |

#### memory_embeddings

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| memory_id | String(32) | FK → memories, INDEX | 关联记忆 |
| embedding | Vector(1536) / Text | NULLABLE | 向量表示（pgvector）或文本占位 |
| model_name | String(100) | NOT NULL | embedding 模型名 |
| content_hash | String(64) | NOT NULL | 内容哈希（用于变更检测） |
| status | String(20) | DEFAULT "pending" | pending/ready/failed |
| error_message | Text | NULLABLE | 失败原因 |
| created_at / updated_at | DateTime(tz) | NOT NULL | 时间戳 |

#### memory_histories

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| memory_id | String(32) | FK → memories, INDEX | 关联记忆 |
| parent_history_id | String(32) | FK → memory_histories, NULLABLE, INDEX | 父版本历史 |
| version_number | Integer | DEFAULT 1 | 版本号 |
| is_current | Boolean | DEFAULT true, INDEX | 是否为当前版本 |
| content | Text | NOT NULL | 记忆内容快照 |
| kind | String(40) | NOT NULL | 分类快照 |
| scope | String(20) | NOT NULL | 作用域快照 |
| status | String(20) | NOT NULL | 状态快照 |
| importance | Integer | DEFAULT 0 | 重要度快照 |
| enabled | Boolean | DEFAULT true | 启用状态快照 |
| change_reason | Text | NULLABLE | 变更原因 |
| changed_by_action | String(20) | NOT NULL | create/update/delete/archive |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

#### memory_audit_logs

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| memory_id | String(32) | FK → memories, INDEX | 关联记忆 |
| user_id | String(32) | FK → users, INDEX | 操作用户 |
| action | String(20) | INDEX | create/update/delete/access/archive |
| action_type | String(20) | NOT NULL | manual/api/automatic/system |
| before_state | Text | NULLABLE | 变更前 JSON 快照 |
| after_state | Text | NULLABLE | 变更后 JSON 快照 |
| details | Text | NULLABLE | 详情 JSON |
| ip_address | String(45) | NULLABLE | 请求 IP |
| request_id | String(32) | NULLABLE | 请求追踪 ID |
| created_at | DateTime(tz) | NOT NULL, INDEX | 创建时间 |

#### attachments

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| message_id | String(32) | FK → messages, ON DELETE CASCADE | 所属消息 |
| name | String(255) | NOT NULL | 原始文件名 |
| stored_name | String(255) | UNIQUE | 存储文件名 |
| mime_type | String(255) | DEFAULT "application/octet-stream" | MIME 类型 |
| kind | String(20) | DEFAULT "file" | image / file |
| size_bytes | Integer | NOT NULL | 文件大小 |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

#### user_sessions

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, ON DELETE CASCADE | 所属用户 |
| token_hash | String(64) | UNIQUE, INDEX | Token SHA256 哈希 |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

#### api_debug_history

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(32) | PK | UUID hex |
| user_id | String(32) | FK → users, ON DELETE CASCADE, INDEX | 所属用户 |
| model | String(100) | NOT NULL | 调试使用的模型 |
| messages | Text | NOT NULL | JSON 格式的消息列表 |
| max_tokens | Integer | DEFAULT 1024 | 最大 token 数 |
| stream | Boolean | DEFAULT true | 是否流式 |
| include_usage | Boolean | DEFAULT true | 是否包含 usage |
| thinking_enabled | Boolean | DEFAULT false | 是否启用推理 |
| reasoning_level | String(20) | NULLABLE | 推理等级 |
| response_status | Integer | DEFAULT 0 | HTTP 状态码 |
| response_time_ms | Integer | DEFAULT 0 | 响应耗时 |
| prompt_tokens | Integer | NULLABLE | 输入 token 数 |
| completion_tokens | Integer | NULLABLE | 输出 token 数 |
| total_tokens | Integer | NULLABLE | 总 token 数 |
| error_message | Text | NULLABLE | 错误信息 |
| created_at | DateTime(tz) | NOT NULL | 创建时间 |

---

## 3. 核心流程设计

### 3.1 聊天主流程（/api/chat） → CHAT-01, MEM-01, MEM-02, MEM-07

```
用户发送消息
    |
    v
[解析请求] -- multipart/form-data 或 JSON
    |
    v
[认证校验] -- Bearer Token → get_current_user
    |
    v
[获取/创建对话] -- conversation_id 存在则加载，否则新建  → CONV-01
    |
    v
[保存用户消息] -- store_message(role="user")
    |
    v
[保存附件] -- 如有上传文件，save_attachments  → CHAT-04
    |
    v
[处理显式记忆意图] -- has_explicit_memory_intent ?  → MEM-01
    |  是                                 | 否
    v                                    v
[创建记忆候选/自动接受]              [构建上下文]
    |                                    |
    v                                    |
[构建上下文] <--------------------------+
    |
    +-- get_chat_context_messages:  → MEM-07
    |     1. 加载长期记忆（向量检索或时间排序）
    |     2. 加载记忆文档（如有）  → MEM-09
    |     3. 加载短期上下文（最近 N 条消息）  → CHAT-05
    |     4. 添加记忆状态通知（如有）
    |
    v
[流式调用 LLM] -- stream_chat_completion  → CHAT-01
    |
    v
[SSE 流式返回] -- 逐 chunk 推送
    |
    v
[保存助手消息] -- store_message(role="assistant")
    |
    v
[后台异步：自动抽取记忆候选]  → MEM-02
    |
    v
[后台异步：生成 embedding] -- 如果候选被自动接受  → MEM-12
```

### 3.2 记忆注入策略 → MEM-07, MEM-09, MEM-12

记忆注入的优先级链：

```
1. 检查是否有 MemoryDocument（记忆文档）
   -- 有且 is_stale=false：直接使用文档内容  → BR-01
   -- 无或 stale：使用逐条记忆

2. 按作用域加载记忆
   -- global: 全局记忆（默认最多 4 条，MEMORY_GLOBAL_LIMIT）
   -- project: 项目记忆（默认最多 6 条，MEMORY_PROJECT_LIMIT）
   -- conversation: 会话记忆（默认最多 6 条，MEMORY_CONVERSATION_LIMIT）

3. 检索策略
   -- PostgreSQL + pgvector 可用：embedding 相似度检索  → MEM-12
   -- 否则：按 last_used_at / updated_at 时间排序

4. 作用域优先级（冲突时）  → BR-02
   -- conversation > project > global
```

### 3.3 记忆候选生命周期 → MEM-01, MEM-02, MEM-03, MEM-04

```
LLM 抽取候选
    |
    v
ExtractedMemoryCandidate
    |
    v
resolve_candidate_scope()  -- 确定 scope
    |
    v
choose_candidate_surface() -- 确定 surface (inline / settings)  → BR-03
    |
    v
[scope == conversation && AUTO_ACCEPT ?]  → BR-04
    | 是                         | 否
    v                            v
auto_accept_memory_candidate   create_memory_candidate
    |                            |
    v                            v
[创建 Memory, 状态=active]   [创建 MemoryCandidate, 状态=pending]
    |                            |
    v                            v
[生成 embedding]              [用户在 inline 或 settings 中审核]
    |                            |
    v                            v
[压缩会话记忆]               [accept / dismiss / defer]
    |                            |
    v                            v
[重建记忆文档]               accept → 创建 Memory
                                  |
                                  v
                               [生成 embedding]
```

### 3.4 候选去重与更新判断 → BR-06

find_existing_memory_match 通过两个维度判断候选与已有记忆的关系：

1. **精确匹配**（duplicate）：normalize 后的 kind:content 完全相同。
2. **身份匹配**（update）：对 preference 类记忆，提取主题关键词比对；其他类型则用 content 文本归一化比对。

### 3.5 会话记忆压缩 → MEM-08

当会话级记忆满足以下任一条件时触发压缩：
- 记忆条数超过 MEMORY_CONVERSATION_COMPACT_THRESHOLD
- 记忆总字符数超过 MEMORY_CONVERSATION_COMPACT_MAX_CHARS

压缩流程：
1. 加载所有 active 的会话记忆。
2. 调用 LLM 生成压缩摘要。
3. 将原记忆全部归档。
4. 创建一条新的 kind=decision 会话记忆存储摘要。

### 3.6 消息版本管理 → CONV-08, CONV-09

```
用户消息 (user)
    |
    +-- v1: 助手回复 (assistant, is_current=true)
    +-- v2: 重新生成 (assistant, is_current=true, v1.is_current=false)
    +-- v3: 再次重新生成 (assistant, is_current=true, v2.is_current=false)
```

- regenerate 接口：基于同一 parent 消息重新调用 LLM，新消息 version_number 自增。
- switch_version 接口：切换 is_current 标记。

---

## 4. 接口设计

### 4.1 V1 聊天端点对比 → CHAT-01, MEM-05, MEM-07

| 端点 | 记忆注入 | 认证 | conversation_id | 说明 |
|------|----------|------|-----------------|------|
| /v1/chat | 可配置（MemoryInjectionConfig） | 可选 | 可选 | 最灵活，完全控制记忆行为 |
| /v1/chat/auto | 自动（等同于默认配置） | 可选 | 可选 | 简化版，自动注入相关记忆 |
| /v1/chat/simple | 无 | 可选 | 必需 | 纯对话，无记忆干扰 |

### 4.2 核心接口请求/响应格式

#### POST /api/chat（主聊天端点）

**请求**（multipart/form-data）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是* | 用户消息文本（与 files 至少提供一个） |
| conversation_id | string | 否 | 对话 ID，不提供则新建 |
| project_id | string | 否 | 项目 ID |
| model | string | 否 | 模型 ID，不提供用默认模型 |
| reasoning_level | string | 否 | off / standard / deep |
| mode | string | 否 | fast / think（兼容旧参数） |
| files | File[] | 否* | 附件文件列表 |

**响应**：SSE 流（text/event-stream）

```
data: {"conversation_id": "abc123"}
data: {"content": "你好"}
data: {"content": "世界"}
data: {"error": "error message"}
data: [DONE]
```

#### POST /api/v1/chat（可配置记忆聊天）

**请求**（application/json）：

```json
{
  "conversation_id": "abc123",
  "project_id": null,
  "message": "你好",
  "model": "qwen3-coder-next",
  "reasoning_level": "off",
  "stream": true,
  "memory": {
    "memory_enabled": true,
    "memory_limit": 10,
    "memory_scope": "all",
    "include_memory_info": false
  }
}
```

**响应**（stream=true）：SSE 流，额外可包含 memory_info 事件。

**响应**（stream=false）：

```json
{
  "conversation_id": "abc123",
  "content": "你好！有什么可以帮你的？",
  "model": "qwen3-coder-next"
}
```

#### POST /api/auth/register

**请求**：

```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**响应**（201）：

```json
{
  "token": "eyJ...",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "created_at": "2026-05-22T10:00:00+00:00"
  }
}
```

#### POST /api/auth/login

请求/响应格式同 register（无 201 状态码，返回 200）。

#### GET /api/conversations/{id}/messages/{mid}/versions → CONV-09

**响应**：

```json
{
  "total": 3,
  "current_version": 2,
  "versions": [
    {
      "id": "msg_v1",
      "version_number": 1,
      "content": "第一次回答...",
      "model": "qwen3-coder-next",
      "is_current": false,
      "created_at": "2026-05-22T10:00:00+00:00"
    },
    {
      "id": "msg_v2",
      "version_number": 2,
      "content": "第二次回答...",
      "model": "kimi-k2.5",
      "is_current": true,
      "created_at": "2026-05-22T10:01:00+00:00"
    }
  ]
}
```

#### POST /api/memory-candidates/{id}/accept → MEM-04

**请求**（可选覆盖内容）：

```json
{
  "content": "用户修改后的记忆内容",
  "kind": "fact",
  "scope": "global",
  "importance": 90
}
```

**响应**：

```json
{
  "candidate": { "...MemoryCandidate 对象..." },
  "memory": { "...新创建的 Memory 对象..." },
  "archived_memory_id": null
}
```

### 4.3 MemoryInjectionConfig

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| memory_enabled | bool | true | 是否注入记忆 |
| memory_limit | int/null | null | 注入条数上限 (1-100)，null 使用配置默认值 |
| memory_scope | string | "all" | global / project / conversation / all |
| include_memory_info | bool | false | 响应中是否包含 memory_info |

### 4.4 错误码定义

| HTTP 状态码 | 错误场景 | detail 示例 |
|-------------|----------|-------------|
| 400 | 请求参数无效 | "Message is required" / "Model xxx is not supported" |
| 401 | 未认证或 Token 失效 | "Invalid email or password" |
| 404 | 资源不存在 | "Conversation not found" / "Message not found" |
| 409 | 资源冲突 | "Email is already registered" |
| 500 | 服务器内部错误 | （LLM API 调用失败等） |
| 503 | 服务不可用 | （数据库连接失败等） |

所有错误响应格式统一为：

```json
{
  "detail": "错误描述文本"
}
```

---

## 5. 模型管理与推理控制 → CHAT-02, CHAT-03

### 5.1 模型目录

模型定义在 config.py 的 AVAILABLE_MODEL_OPTIONS 中，每个模型包含：

| 字段 | 说明 |
|------|------|
| id | 模型标识符 |
| label | 显示名称 |
| latency_hint | 延迟提示（fast/balanced/slower） |
| reasoning_mode | 推理模式（none/toggle/budget/always_budget） |
| experimental_reasoning | 是否实验性推理 |
| max_tokens | 最大输出 token 数 |

当前支持的模型列表：

| id | label | reasoning_mode | latency_hint |
|----|-------|----------------|--------------|
| qwen3-coder-next | Qwen 3 Coder Next | none | fast |
| qwen3-coder-plus | Qwen 3 Coder Plus | none | fast |
| kimi-k2.5 | Kimi K2.5 | toggle | fast |
| MiniMax-M2.5 | MiniMax M2.5 | always_budget | balanced |
| qwen3.5-plus | Qwen 3.5 Plus | budget | balanced |
| qwen3.6-plus | Qwen 3.6 Plus | budget | slower |
| glm-5 | GLM-5 | budget | slower |

### 5.2 推理模式映射

| reasoning_mode | off | standard | deep |
|----------------|-----|----------|------|
| none | 无推理 | 无推理 | 无推理 |
| toggle | 关闭 | 开启 | 开启 |
| budget | 关闭 | standard budget(32) | deep budget(256) |
| always_budget | standard budget(32) | standard budget(32) | deep budget(256) |

### 5.3 模型特有参数

不同模型通过 extra_body 传递不同的推理控制参数：

| 模型 | 参数 | 说明 |
|------|------|------|
| Qwen 3.5/3.6 Plus | enable_thinking + thinking_budget | thinking 为 bool，budget 为 int |
| GLM-5 | thinking.type + thinking.budget_tokens | type 为 enabled/disabled |
| MiniMax M2.5 | reasoning_split + thinking_budget | reasoning_split 固定 true |
| Kimi K2.5 | thinking.type | type 为 enabled/disabled |

---

## 6. 向量检索设计 → MEM-12

### 6.1 架构

```
记忆创建/更新
    |
    v
memory_embedding_service.generate_embedding_async()
    |
    v
embedding_service.create_embedding()  -- 调用 embedding API
    |
    v
存储到 memory_embeddings 表
    |
    v
聊天时: vector_search_service.search_memories_by_text()
    |
    v
生成查询 embedding → cosine 相似度检索 → 返回 top_k 结果
```

### 6.2 降级策略

```
PostgreSQL + pgvector + embedding 配置正常
    → 语义相似度检索
    |
    v 不可用
PostgreSQL 但无 pgvector / SQLite
    → 按 last_used_at / updated_at 时间排序
    |
    v 语义检索失败且 EMBEDDING_FALLBACK_TO_TIME_SORT=true
时间排序（降级兜底）
```

---

## 7. 前端设计

### 7.1 状态管理

App.tsx 是唯一的全局状态容器，使用 React useState + useCallback + useMemo 管理。核心状态分组：

- **认证状态**：currentUser, authErrorMessage, isAuthenticating
- **对话状态**：conversations, activeConvId, messages, isStreaming
- **模型状态**：modelOptions, selectedModel, reasoningLevel
- **记忆状态**：globalMemories, projectMemories, conversationMemories, memoryCandidates
- **UI 状态**：isSettingsCenterOpen, isModelPickerOpen, isSidebarCollapsed

> **演进建议**：随着功能增长，App.tsx 可能成为巨型组件。建议后续按领域拆分为多个 Context（如 AuthContext, ChatContext, MemoryContext），或引入轻量状态管理库（如 Zustand）。当前阶段 useState 方案可满足需求。

### 7.2 数据持久化

以下状态持久化到 localStorage：

| Key | 内容 |
|-----|------|
| memory-chat:auth-token | Bearer Token |
| memory-chat:selected-model | 当前模型 ID |
| memory-chat:reasoning-level | 推理等级 |
| memory-chat:sidebar-collapsed | 侧边栏折叠状态 |
| memory-chat:active-view | 当前视图 |
| memory-chat:settings-section | 设置面板选中项 |
| memory-chat:theme | 主题 |
| memory-chat:active-conversation | 活跃对话 ID |

### 7.3 SSE 流式处理

前端通过 fetch + ReadableStream 处理 SSE：

1. 发送请求获取 Response。
2. 从 response.body 获取 ReadableStream reader。
3. 逐块解码，按换行符分割行。
4. 解析 data: 前缀的 JSON 事件。
5. 更新 streamingContent 状态触发 UI 重渲染。
6. 收到 [DONE] 后刷新完整消息列表。

支持 AbortController 中断流式传输。

### 7.4 SSE 断线处理

网络中断或服务端异常断开时的处理策略：

| 场景 | 处理方式 |
|------|----------|
| 用户主动中断 | AbortController.abort()，前端标记流结束 |
| 网络中断 | ReadableStream 抛出异常，前端展示"连接中断"提示，已接收内容保留 |
| 服务端异常关闭 | 检测到 [DONE] 未到达但流关闭，展示"生成中断"提示 |

> **注**：当前版本不做自动重连和续传，因为每次聊天请求是独立的 HTTP 连接而非长连接。用户只需重新发送消息即可恢复。

### 7.5 内联候选轮询 → MEM-02, MEM-03

发送消息后，前端按 1s、3s、6s、10s 的延迟轮询 inline 候选（因为后端是异步抽取的）：

```
handleSend() 完成
    |
    v
scheduleInlineCandidatePolls()
    |
    +-- setTimeout 1s  → loadInlineCandidate()
    +-- setTimeout 3s  → loadInlineCandidate()
    +-- setTimeout 6s  → loadInlineCandidate()
    +-- setTimeout 10s → loadInlineCandidate()
```

切换对话或用户登出时清除所有定时器。

---

## 8. 安全设计 → NFR-S01~S06

### 8.1 认证与授权

| 层级 | 机制 | 说明 |
|------|------|------|
| 密码存储 | bcrypt 哈希 | 不可逆，自动加盐 |
| Token 生成 | 服务端生成随机 Token | 存储其 SHA256 哈希到 user_sessions 表 |
| Token 校验 | 请求头 Authorization: Bearer xxx | 从哈希查找 session，关联 user |
| Token 失效 | 登出时删除 session 记录 | 单 Token 粒度，不影响其他设备 |
| 可选认证 | get_optional_user | V1 端点使用，有 Token 则解析，无则返回 null |

### 8.2 数据隔离

- 所有需要认证的端点通过 Depends(get_current_user) 获取当前用户。
- 所有数据查询（对话、消息、记忆、项目）强制添加 WHERE user_id = ? 条件。
- 更新和删除操作先校验 user_id 归属，不匹配返回 404。

### 8.3 输入安全

| 风险 | 防护 |
|------|------|
| XSS | 前端使用 React JSX 自动转义；API 不返回 HTML |
| SQL 注入 | 使用 SQLAlchemy ORM 参数化查询，不拼接 SQL |
| 文件上传 | 校验文件大小（10 MB）、数量（6 个/消息）；存储使用随机文件名 |
| 敏感记忆 | LLM 抽取时过滤密码、身份证等敏感信息（sensitive=true 跳过） |
| CORS | 开发 allow_origins=["*"]，生产应限制为前端域名 |

---

## 9. 并发与一致性设计

### 9.1 记忆候选并发操作

**风险场景**：用户在 inline 和 settings 面板同时对同一候选执行 accept/dismiss。

**策略**：利用数据库行级锁 + 状态校验。操作前先查询候选状态，若 status != pending 则返回 409 提示"候选已处理"。在事务内完成状态更新，避免竞态。

### 9.2 会话记忆压缩并发触发

**风险场景**：多个并发请求同时检测到压缩阈值被触发，重复执行压缩。

**策略**：压缩逻辑入口添加分布式互斥（当前单机可用内存锁或数据库 advisory lock）。后续如需分布式部署，可引入 Redis 锁。

### 9.3 记忆文档 stale 标记

**风险场景**：记忆变更后文档标记为 stale，但多个请求同时触发文档重建。

**策略**：文档重建采用"先标记 stale、后异步重建、完成即清除 stale"模式。并发重建以最后完成为准，文档内容为最终一致。

---

## 10. 缓存策略

### 10.1 记忆注入缓存

| 缓存项 | 策略 | 说明 |
|--------|------|------|
| 同一对话的短期上下文 | 无缓存（每次从 DB 加载） | 消息频繁变更，缓存收益低 |
| 同一用户的长期记忆列表 | 可选 LRU 内存缓存（TTL 30s） | 记忆变更频率低，缓存命中率高 |
| 记忆文档内容 | 可选 LRU 内存缓存（TTL 60s） | 文档变更后 stale 标记清除缓存 |

> **注**：当前版本不引入缓存层，直接查询数据库。当性能指标（NFR-P02）不达标时再按需引入。

### 10.2 前端缓存

| 缓存项 | 策略 |
|--------|------|
| 模型列表 | 首次加载后缓存，刷新页面重新获取 |
| 对话列表 | 每次操作后主动刷新，不做本地缓存 |
| localStorage 持久化 | 仅存储用户偏好和 UI 状态（参见 §7.2） |

---

## 11. 配置管理

所有配置通过环境变量或 .env 文件加载（pydantic-settings）。

### 11.1 核心配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| OPENAI_API_KEY | "" | LLM API Key |
| OPENAI_BASE_URL | "https://api.openai.com/v1" | LLM API Base URL |
| OPENAI_MODEL | "gpt-3.5-turbo" | 默认模型 |
| MEMORY_MODEL | "" | 记忆抽取专用模型（空则用 OPENAI_MODEL） |
| DATABASE_URL | "" | 数据库连接字符串（优先于 DB_* 组合参数） |
| DB_DRIVER | "sqlite" | 数据库驱动（sqlite / postgresql+psycopg 等） |
| DB_HOST | "" | 数据库主机 |
| DB_PORT | "" | 数据库端口 |
| DB_NAME | "./chat.db" | 数据库名称 |
| DB_USER | "" | 数据库用户 |
| DB_PASSWORD | "" | 数据库密码 |
| CONTEXT_WINDOW_SIZE | 20 | 短期上下文窗口大小 |
| APP_TIMEZONE | "Asia/Shanghai" | 应用时区 |

### 11.2 记忆配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| MEMORY_GLOBAL_LIMIT | 4 | 全局记忆注入上限 |
| MEMORY_PROJECT_LIMIT | 6 | 项目记忆注入上限 |
| MEMORY_CONVERSATION_LIMIT | 6 | 会话记忆注入上限 |
| MEMORY_AUTO_SUGGESTIONS_ENABLED | true | 是否启用自动记忆抽取 |
| MEMORY_CONVERSATION_AUTO_ACCEPT | true | 会话记忆是否自动接受 |
| MEMORY_CONVERSATION_COMPACT_THRESHOLD | 0 | 会话压缩条数阈值（0=不限） |
| MEMORY_CONVERSATION_COMPACT_MAX_CHARS | 3000 | 会话压缩字符数阈值 |
| MEMORY_INLINE_CONFIDENCE_THRESHOLD | 85 | inline 展示的置信度阈值 |
| MEMORY_INLINE_IMPORTANCE_THRESHOLD | 80 | inline 展示的重要度阈值 |
| MEMORY_CANDIDATE_CONFIDENCE_THRESHOLD | 70 | 候选创建的最低置信度 |
| MEMORY_DOCUMENTS_AI_ENABLED | false | 记忆文档是否使用 AI 生成（false 时用 fallback 模式） |

### 11.3 Embedding 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| EMBEDDING_ENABLED | true | 是否启用 embedding |
| EMBEDDING_API_KEY | "" | Embedding API Key |
| EMBEDDING_BASE_URL | "" | Embedding API Base URL |
| EMBEDDING_MODEL | "text-embedding-3-small" | Embedding 模型 |
| EMBEDDING_DIMENSION | 1536 | 向量维度 |
| VECTOR_SEARCH_TOP_K | 20 | 向量检索返回数量 |
| VECTOR_SEARCH_THRESHOLD | 0.7 | 相似度阈值 |
| EMBEDDING_FALLBACK_TO_TIME_SORT | true | 检索失败时是否降级 |

---

## 12. 数据库迁移

使用 Alembic 管理数据库结构变更，迁移文件位于 backend/alembic/versions/。

已有迁移：

| 迁移文件 | 日期 | 内容 |
|----------|------|------|
| 20260427_0001_create_initial_schema | 2026-04-27 | 创建初始 schema：users, conversations, messages, attachments, user_sessions |
| 20260427_0002_create_memories | 2026-04-27 | 创建 memories 表 |
| 20260427_0003_create_projects_and_project_memory_scope | 2026-04-27 | 创建 projects 表、项目记忆作用域 |
| 20260427_0003_add_scoped_memory_candidates | 2026-04-27 | 添加 scoped memory_candidates |
| 20260428_0005_create_memory_documents | 2026-04-28 | 创建 memory_documents 表 |
| 20260428_0006_add_memory_document_generation_status | 2026-04-28 | 添加 memory_documents 生成状态字段 |
| 20260509_0001_add_message_versions | 2026-05-09 | 添加消息版本功能 |
| 20260512_0001_add_memory_history_and_audit | 2026-05-12 | 添加记忆历史和审计 |
| 20260513_0001_add_memory_embeddings | 2026-05-13 | 添加记忆 embedding |
| 20260520_0001_create_api_debug_history | 2026-05-20 | 创建 api_debug_history 表 |

> **注**：20260427_0003 存在两个迁移文件（create_projects_and_project_memory_scope 和 add_scoped_memory_candidates），这是同一天的同序号迁移。Alembic 通过 revision chain（down_revision）保证执行顺序，文件名中的编号仅为方便识别。

---

## 13. 错误处理策略

| 场景 | 策略 | 影响范围 | 用户感知 |
|------|------|----------|----------|
| 记忆加载失败 | 降级为无记忆上下文，后端打日志 | 仅影响记忆注入 | 无感知，聊天正常 |
| 记忆保存失败 | 回滚事务，后端打日志 | 仅影响记忆创建 | 无感知，聊天正常 |
| 记忆抽取 LLM 失败 | 静默忽略，不打断聊天 | 后台异步任务 | 无感知 |
| LLM API 调用失败 | SSE 推送 error 事件 | 当前对话 | 前端展示错误信息 |
| 附件保存失败 | 删除已创建的消息和对话，返回 HTTP 错误 | 整个请求回滚 | 前端展示错误信息 |
| 数据库迁移失败 | 阻止启动 | 部署阶段 | 服务不可用 |
| Token 认证失败 | 返回 401 | 需认证的端点 | 前端跳转登录 |
| 向量检索失败 | 降级为时间排序（如启用降级配置） | 仅影响检索精度 | 无感知 |
| 数据库连接失败 | 返回 503 | 所有依赖数据库的请求 | 前端展示服务不可用 |

---

## 14. 部署架构

### 14.1 开发环境

```
开发者本机
  |
  +-- Vite dev server (:5173) → proxy /api → :8000
  |
  +-- FastAPI (uvicorn :8000)
       |
       +-- SQLite (chat.db)
       +-- 外部 LLM API
```

### 14.2 生产环境（推荐）

```
用户浏览器
  |
  v
Nginx / Caddy（反向代理 + HTTPS）
  |
  +-- / → 静态文件（React 构建产物）
  +-- /api → FastAPI (uvicorn :8000)
       |
       +-- PostgreSQL + pgvector
       +-- 外部 LLM API
```

### 14.3 部署清单

| 事项 | 说明 |
|------|------|
| HTTPS | 生产环境必须启用，推荐 Let's Encrypt |
| CORS | 生产环境限制 allow_origins 为前端域名 |
| 数据库 | 推荐 PostgreSQL，需安装 pgvector 扩展 |
| 文件存储 | 附件存储在 uploads 目录，需确保目录可写 |
| 环境变量 | 至少配置 OPENAI_API_KEY、OPENAI_BASE_URL、DATABASE_URL |
| 进程管理 | 推荐 systemd 或 Docker 容器化 |
| 日志 | 后端日志输出到 stdout/stderr，建议配置日志轮转 |
| 备份 | 定期备份 PostgreSQL 数据库和 uploads 目录 |

---

## 15. 需求追溯矩阵

### 15.1 设计章节 → 需求编号

| 设计章节 | 对应需求 |
|----------|----------|
| §3.1 聊天主流程 | CHAT-01, CHAT-04, CHAT-05, CONV-01, MEM-01, MEM-02, MEM-07 |
| §3.2 记忆注入策略 | MEM-07, MEM-09, MEM-12, BR-01, BR-02 |
| §3.3 记忆候选生命周期 | MEM-01, MEM-02, MEM-03, MEM-04, BR-03, BR-04 |
| §3.4 候选去重与更新 | BR-06 |
| §3.5 会话记忆压缩 | MEM-08 |
| §3.6 消息版本管理 | CONV-08, CONV-09 |
| §4.1 V1 端点对比 | CHAT-01, MEM-05, MEM-07 |
| §5. 模型管理与推理控制 | CHAT-02, CHAT-03 |
| §6. 向量检索设计 | MEM-12 |
| §7.5 内联候选轮询 | MEM-02, MEM-03 |
| §8. 安全设计 | AUTH-01~04, NFR-S01~S06 |
| §9. 并发与一致性 | BR-03, BR-04, MEM-08 |

### 15.2 需求编号 → 设计章节

| 需求编号 | 涉及设计章节 |
|----------|--------------|
| AUTH-01~04 | §8.1 认证与授权 |
| CONV-01 | §3.1 聊天主流程 |
| CONV-02~07 | §2.2 conversations 表、§4.2 接口设计 |
| CONV-08~09 | §3.6 消息版本管理 |
| CHAT-01 | §3.1 聊天主流程、§7.3 SSE 流式处理 |
| CHAT-02 | §5.1 模型目录 |
| CHAT-03 | §5.2 推理模式映射、§5.3 模型特有参数 |
| CHAT-04 | §3.1 聊天主流程 |
| CHAT-05 | §3.2 记忆注入策略 |
| MEM-01~04 | §3.3 记忆候选生命周期 |
| MEM-05 | §2.2 memories 表 scope 字段 |
| MEM-06 | §4.2 记忆 CRUD 接口 |
| MEM-07 | §3.2 记忆注入策略 |
| MEM-08 | §3.5 会话记忆压缩 |
| MEM-09 | §3.2 记忆注入策略、§2.2 memory_documents 表 |
| MEM-10 | §2.2 memory_histories 表 |
| MEM-11 | §2.2 memory_audit_logs 表 |
| MEM-12 | §6 向量检索设计 |
| PROJ-01~05 | §2.2 projects 表、§3.2 作用域加载 |
| BR-01~08 | §3.2 注入策略、§3.3 候选生命周期、§3.4 去重、§9 并发策略 |
