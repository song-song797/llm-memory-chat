# LLM Memory Chat - 核心流程序列图

## 1. 用户聊天主流程（Chat Flow）

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端 (React)
    participant BE as 后端 (FastAPI)
    participant MS as MemoryService
    participant LLM as LLM API
    participant DB as 数据库 (SQLite/PG)

    U->>FE: 输入消息 + 可选附件
    FE->>BE: POST /api/chat (multipart/form-data, SSE)
    Note over FE,BE: Authorization: Bearer <token>

    BE->>DB: 验证用户身份 (get_current_user)
    BE->>DB: 创建/获取会话 (Conversation)
    BE->>DB: 存储用户消息 (Message)

    %% 记忆命令检测
    BE->>MS: 检测显式记忆命令 ("请记住"等)
    alt 检测到显式记忆命令
        MS->>DB: 创建记忆候选 (auto-accept)
    end

    %% 构建上下文
    BE->>MS: get_chat_context_messages()
    MS->>DB: 语义向量搜索相关记忆 (pgvector)
    Note over MS: 优先使用 MemoryDocument<br/>（整合摘要），回退到独立 Memory
    MS->>DB: 按作用域加载记忆 (global > project > conversation)
    MS->>DB: 加载最近对话消息 (CONTEXT_WINDOW_SIZE)
    MS-->>BE: 返回合并后的上下文消息列表

    %% 调用 LLM
    BE->>LLM: stream_chat_completion(messages)
    LLM-->>BE: SSE 流式响应 (chunk by chunk)
    BE-->>FE: StreamingResponse (SSE)

    loop SSE 事件流
        FE->>FE: 解析 SSE 事件，实时渲染
        Note over FE: event: {"content": "...chunk..."}
    end
    Note over FE: 收到 [DONE] 事件

    BE->>DB: 存储助手消息 (Message)

    %% 后台记忆提取
    Note over BE: Background Task (异步)
    BE->>MS: extract_memory_candidate(user_message)
    MS->>LLM: 第二次 LLM 调用 (memory model)
    LLM-->>MS: 返回结构化记忆候选 JSON
    MS->>DB: 存储 MemoryCandidate (pending)

    %% 前端轮询记忆候选
    FE->>BE: GET /api/memory-candidates (1s/3s/6s/10s)
    BE->>DB: 查询待审记忆候选
    DB-->>BE: 返回候选列表
    BE-->>FE: 返回候选列表
    FE->>U: 显示内联记忆建议卡片
```

## 2. 记忆提取与审批流程（Memory Pipeline）

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant BE as 后端
    participant MCS as MemoryCandidateService
    participant MES as MemoryExtractionService
    participant LLM as LLM API (Memory Model)
    participant DB as 数据库

    Note over MES,LLM: 阶段1: 提取记忆候选
    MES->>LLM: 分析用户消息，提取记忆
    Note over MES,LLM: Prompt 要求返回 JSON:<br/>{content, kind, scope, action,<br/>confidence, importance, sensitivity}
    LLM-->>MES: 结构化 JSON 结果

    MES->>MES: 过滤: 置信度过低? 敏感内容?
    MES->>MCS: 创建候选 (dedup by 文本归一化)

    alt 置信度高 + conversation 作用域
        MCS->>DB: 自动接受 (auto-accept)
    else 其他情况
        MCS->>DB: 存为 pending 状态
    end

    Note over U,DB: 阶段2: 用户审批
    FE->>BE: GET /api/memory-candidates
    BE->>DB: 查询 pending 候选
    DB-->>FE: 返回候选列表

    alt 用户接受候选
        U->>FE: 点击"接受"
        FE->>BE: POST /api/memory-candidates/{id}/accept
        BE->>MCS: accept_candidate()
        MCS->>DB: 创建 Memory 记录
        MCS->>DB: 生成 Embedding 向量
        MCS->>DB: 更新候选状态为 accepted
        MCS->>DB: 写入审计日志 (MemoryAuditLog)
    else 用户拒绝候选
        U->>FE: 点击"忽略"
        FE->>BE: POST /api/memory-candidates/{id}/dismiss
        MCS->>DB: 更新候选状态为 dismissed
    else 用户稍后决定
        U->>FE: 点击"稍后"
        FE->>BE: POST /api/memory-candidates/{id}/defer
        MCS->>DB: 更新候选状态为 deferred
    end
```

## 3. 记忆检索与注入流程（Memory Retrieval）

```mermaid
sequenceDiagram
    participant BE as 后端
    participant MS as MemoryService
    participant VS as VectorSearchService
    participant ES as EmbeddingService
    participant LLM as Embedding API
    participant DB as 数据库

    BE->>MS: get_chat_context_messages(conversation_id, user_id)
    MS->>MS: 确定作用域链 (global → project → conversation)

    %% 向量搜索路径
    alt PostgreSQL + pgvector 可用
        MS->>VS: semantic_search(query, user_id, top_k)
        VS->>ES: generate_embedding(user_message)
        ES->>LLM: 调用 Embedding API
        LLM-->>ES: 返回向量 (1536维)
        ES-->>VS: 返回 embedding
        VS->>DB: SELECT * FROM memories<br/>ORDER BY embedding <=> query_vec<br/>LIMIT top_k
        DB-->>VS: 返回语义相关的记忆
        VS-->>MS: 返回排序后的记忆列表
    else SQLite / 向量不可用
        MS->>DB: 按时间排序加载记忆
        DB-->>MS: 返回记忆列表
    end

    %% 记忆文档优先
    MS->>DB: 查询 MemoryDocument (整合摘要)
    alt 存在 MemoryDocument
        MS->>MS: 使用文档摘要替代独立记忆条目
        Note over MS: 优先级: MemoryDocument > Individual Memories
    end

    %% 组装上下文
    MS->>MS: 合并: 记忆文档 + 独立记忆 + 对话消息
    Note over MS: 最终上下文结构:<br/>1. System Prompt (含时区、模型身份)<br/>2. 记忆上下文 (文档/条目)<br/>3. 最近对话消息 (滑动窗口)
    MS-->>BE: 返回完整上下文消息列表
```

## 4. 认证流程（Authentication）

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant BE as 后端 (AuthService)
    participant DB as 数据库

    Note over U,DB: 注册流程
    U->>FE: 填写邮箱 + 密码
    FE->>BE: POST /api/auth/register {email, password}
    BE->>BE: scrypt 哈希密码 (n=16384, r=8, p=1)
    BE->>DB: 创建 User 记录
    BE->>BE: 生成 token (secrets.token_urlsafe)
    BE->>BE: SHA-256 哈希 token
    BE->>DB: 创建 UserSession 记录
    BE-->>FE: 返回 {user, token}
    FE->>FE: localStorage 存储 token

    Note over U,DB: 登录流程
    U->>FE: 输入邮箱 + 密码
    FE->>BE: POST /api/auth/login {email, password}
    BE->>DB: 查询 User by email
    BE->>BE: scrypt 验证密码
    BE->>BE: 生成新 token + SHA-256 哈希
    BE->>DB: 创建 UserSession 记录
    BE-->>FE: 返回 {user, token}
    FE->>FE: localStorage 存储 token

    Note over U,DB: 请求鉴权
    FE->>BE: 任意 API 请求 + Authorization: Bearer <token>
    BE->>BE: SHA-256(token) → 查询 UserSession
    BE->>DB: 查找 session + 关联 user
    BE->>BE: 注入 user 到请求上下文
    BE-->>BE: 继续处理业务逻辑
```

## 5. 记忆作用域与三级层次

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant BE as 后端
    participant MS as MemoryService
    participant DB as 数据库

    Note over U,DB: 三级记忆作用域: global → project → conversation

    %% Global 记忆
    Note over U,DB: 创建/编辑全局记忆
    U->>FE: 在设置面板管理记忆
    FE->>BE: POST /api/memories {scope: "global"}
    BE->>MS: 创建记忆
    MS->>DB: 存储到 memories 表
    MS->>DB: 生成 embedding
    MS->>DB: 写入审计日志

    %% Project 记忆
    Note over U,DB: 项目关联记忆
    U->>FE: 在项目上下文中管理记忆
    FE->>BE: POST /api/memories {scope: "project", project_id: "..."}
    BE->>DB: 存储带项目关联的记忆

    %% Conversation 记忆
    Note over U,DB: 会话级记忆 (通常自动提取)
    BE->>MS: 自动提取对话中的记忆
    MS->>DB: 存储带会话关联的记忆

    %% 注入时的优先级
    Note over MS,DB: 上下文注入时的优先级
    MS->>DB: 1. 查询 MemoryDocument (整合摘要)
    alt 有文档摘要
        Note over MS: 直接使用摘要，不再加载独立条目
    else 无文档摘要
        MS->>DB: 2. 加载独立 Memory 条目
        Note over MS: 按作用域: global → project → conversation<br/>按相关度/时间排序
    end
    MS->>DB: 3. 加载最近对话消息 (滑动窗口)
```

## 6. V1 API 记忆注入模式

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant BE as 后端 (chat_v1)
    participant MS as MemoryService
    participant LLM as LLM API

    Note over Client,LLM: 三种记忆注入模式

    %% auto 模式
    rect rgb(230, 245, 255)
        Note over Client,LLM: /api/v1/chat/auto — 自动注入
        Client->>BE: POST /api/v1/chat/auto
        BE->>MS: 自动检索相关记忆
        MS-->>BE: 返回记忆上下文
        BE->>LLM: 带记忆上下文调用 LLM
        LLM-->>Client: 流式响应
    end

    %% configurable 模式
    rect rgb(255, 245, 230)
        Note over Client,LLM: /api/v1/chat — 可配置注入
        Client->>BE: POST /api/v1/chat {memory_mode: "auto/manual/none"}
        alt memory_mode = "auto"
            BE->>MS: 自动检索
        else memory_mode = "manual"
            Note over BE: 使用客户端提供的记忆
        else memory_mode = "none"
            Note over BE: 不注入任何记忆
        end
        BE->>LLM: 按配置调用 LLM
        LLM-->>Client: 流式响应
    end

    %% simple 模式
    rect rgb(245, 255, 230)
        Note over Client,LLM: /api/v1/chat/simple — 无记忆
        Client->>BE: POST /api/v1/chat/simple
        Note over BE: 跳过所有记忆逻辑
        BE->>LLM: 纯对话调用
        LLM-->>Client: 流式响应
    end
```

## 7. 消息版本管理（Message Versioning）

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant BE as 后端
    participant DB as 数据库

    %% 正常消息
    Note over U,DB: 正常对话
    U->>FE: 发送消息
    FE->>BE: POST /api/chat
    BE->>DB: 存储 Message (version=1)
    BE-->>FE: 流式响应

    %% 重新生成
    Note over U,DB: 重新生成助手回复
    U->>FE: 点击"重新生成"
    FE->>BE: POST /api/conversations/{cid}/messages/{mid}/regenerate
    BE->>DB: 查询原 Message (parent_message_id)
    BE->>BE: 构建上下文 (截至父消息)
    BE->>BE: 调用 LLM 重新生成
    BE->>DB: 创建新 Message (version=N+1)
    Note over DB: 保留旧版本，新版本指向旧版本
    BE-->>FE: 返回新版本内容

    %% 版本切换
    Note over U,DB: 切换版本
    U->>FE: 点击版本选择器
    FE->>BE: GET /api/conversations/{id}
    BE->>DB: 查询所有版本消息
    BE-->>FE: 返回含版本信息的消息列表
    FE->>FE: 显示选中版本内容
```
