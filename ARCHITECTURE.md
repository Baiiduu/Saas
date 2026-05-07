# Architecture: SaaS多租户企业协作平台
邮箱：dev@example.com
密码：DevPass123!

## Requirements Baseline

本文档基于 [REQUIREMENTS.md](./REQUIREMENTS.md) 中的完整需求分析，该文档覆盖了原型展示（MVP）、V1 可落地、V2 可增强三个阶段的全部功能与非功能需求。

核心范围：面向中小企业和项目型团队的多租户协作平台，以"企业空间"为顶层组织单位、以"团队"为协作单元、以"任务、文档、仓库资源"为核心载体，集成通知、评论、附件、共享权限、审批流、协作资源图谱和大模型协作能力。

## Architecture Goals

| 目标 | 说明 |
|------|------|
| AG1 - 多租户优先 | 一套平台实例支撑多个企业，账号、权限、数据、模型调用、审批和通知层面均严格隔离 |
| AG2 - 协作闭环 | 任务驱动执行 → 文档沉淀成果 → 资源关联上下文 → 通知串联反馈 |
| AG3 - 可演进架构 | 功能按"原型可展示 → V1可落地 → V2可增强"分层推进，架构本身支持增量演进 |
| AG4 - 可验证交付 | 每条需求均可通过页面原型、接口行为或测试用例验证 |
| AG5 - 前端优先 | 原型阶段以可交互前端为主，后端可 mock；V1 补齐完整后端 |
| AG6 - 可扩展性 | 为大模型接入（MCP/Skill）预留统一的扩展点 |

## Non-Goals

| 项目 | 说明 |
|------|------|
| 不开发移动端原生 App | 仅提供 Web 端，移动端通过浏览器响应式访问 |
| 不深度集成第三方 IM/邮箱/日历/网盘 | 不开发深度对接，仅保留基础通知能力 |
| 不实现 BPMN 级流程设计器 | 审批流采用简洁的线性节点配置，不支持复杂条件分支 |
| 不实现大规模分布式调度与灰度发布 | 系统面向中小规模团队（≤ 1000 并发），不涉及微服务灰度能力 |
| 不支持国际化/多语言 | 当前阶段仅支持中文，后续按需扩展 |
| 不提供开放 API 供外部系统集成 | 当前阶段聚焦内部功能，V2 后按需评估 |

## Frontend Stack

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **React 18** | 18.x | 成熟组件化生态，Hooks 驱动，社区活跃，TypeScript 支持优秀；团队熟悉度高 |
| **TypeScript** | 5.x | 全栈类型安全，减少运行时错误，提升协作效率 |
| **Vite** | 5.x | 极速 HMR，ESBuild 编译，优于 CRA/Webpack 的开发体验 |
| **Ant Design 5** | 5.x | 企业级 UI 组件库，表格/表单/弹窗/树形控件开箱即用，满足 NF20 |
| **React Router v6** | 6.x | 嵌套路由 + 布局路由，天然适配多层级页面结构 |
| **Zustand** | 4.x | 轻量状态管理，无 boilerplate，适合中大型 SPA |
| **TanStack React Query** | 5.x | 服务端状态管理，缓存/重试/乐观更新，减少手写数据获取逻辑 |
| **Axios** | 1.x | HTTP 客户端，拦截器机制便于统一处理 Token/租户 ID/错误 |
| **React DnD / dnd-kit** | - | 看板拖拽功能（F36），dnd-kit 更现代且无障碍支持好 |
| **React Flow** | - | 协作资源图谱可视化（F59），支持自定义节点与边 |
| **ECharts / AntV G2** | - | 仪表盘图表（F80-F82） |

### 状态管理策略

```
┌──────────────────────────────────────────────────────┐
│                     Zustand Store                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ authStore  │ │ uiStore  │ │ workspaceStore    │    │
│  │ 用户/Token │ │ 侧栏/主题│ │ 当前企业/团队     │    │
│  └────────────┘ └──────────┘ └──────────────────┘    │
├──────────────────────────────────────────────────────┤
│              TanStack React Query (Server State)      │
│  ┌──────────┐ ┌───────┐ ┌────────┐ ┌────────────┐   │
│  │ useTasks │ │useDocs│ │useTeams│ │useNotifcations│  │
│  └──────────┘ └───────┘ └────────┘ └────────────┘   │
├──────────────────────────────────────────────────────┤
│              React Router v6 (URL State)              │
│  /:tenantSlug/:teamSlug/tasks/:taskId                 │
└──────────────────────────────────────────────────────┘
```

### 路由设计

| 路径 | 页面 | 阶段 |
|------|------|------|
| `/auth/login` | 登录页 | 原型 |
| `/auth/register` | 注册页 | 原型 |
| `/auth/activate` | 账号激活页 | 原型 |
| `/auth/reset-password` | 重置密码 | V1 |
| `/` | 企业选择页（多企业归属） | 原型 |
| `/org/:orgId` | 企业工作台/仪表盘 | 原型 |
| `/org/:orgId/settings` | 企业设置 | V1 |
| `/org/:orgId/audit` | 审计日志 | V1 |
| `/org/:orgId/team/:teamId` | 团队看板 | 原型 |
| `/org/:orgId/team/:teamId/tasks` | 任务列表 | 原型 |
| `/org/:orgId/team/:teamId/tasks/:taskId` | 任务详情 | 原型 |
| `/org/:orgId/team/:teamId/board` | 看板视图 | 原型 |
| `/org/:orgId/team/:teamId/gantt` | 甘特图 | V1 |
| `/org/:orgId/team/:teamId/calendar` | 月历视图 | V1 |
| `/org/:orgId/team/:teamId/docs` | 文档中心 | 原型 |
| `/org/:orgId/team/:teamId/docs/:docId` | 文档详情/预览 | 原型 |
| `/org/:orgId/team/:teamId/approvals` | 审批列表 | 原型 |
| `/org/:orgId/team/:teamId/approvals/:approvalId` | 审批详情 | 原型 |
| `/org/:orgId/team/:teamId/messages` | 团队消息 | V1 |
| `/org/:orgId/team/:teamId/milestones` | 里程碑 | V1 |
| `/org/:orgId/team/:teamId/graph` | 资源图谱 | V1 |
| `/org/:orgId/team/:teamId/settings` | 团队设置 | 原型 |
| `/org/:orgId/team/:teamId/members` | 团队成员管理 | 原型 |
| `/notifications` | 通知中心 | 原型 |
| `/user/profile` | 个人设置 | V1 |
| `/user/stats` | 个人任务统计 | 原型 |

### 前端组件树（简化）

```
<App>
  <AuthProvider>
    <QueryClientProvider>
      <RouterProvider>
        <RootLayout>
          <Sidebar />            <!-- 企业/团队切换、导航 -->
          <Header />             <!-- 全局搜索、通知、用户头像 -->
          <Breadcrumb />
          <Outlet />             <!-- 页面内容 -->
        </RootLayout>
      </RouterProvider>
    </QueryClientProvider>
  </AuthProvider>
</App>
```

## Backend Stack

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **Node.js** | 20 LTS | 非阻塞 I/O 适合协作类高 IO 场景；与前端共享 TypeScript 类型 |
| **NestJS** | 10.x | 模块化架构（Module/Controller/Service/Repository），内置 DI、Guards、Interceptors、Pipes，天然适合多模块企业应用 |
| **TypeScript** | 5.x | 全栈类型安全，编译期发现错误 |
| **PostgreSQL** | 16.x | Schema 级多租户隔离、JSONB 支持灵活字段、全文检索、窗口函数 |
| **Redis** | 7.x | Session 缓存、通知队列、API 限流计数器、WebSocket 消息代理 |
| **MinIO** | - | 自托管 S3 兼容对象存储，文件存储统一方案 |
| **Prisma ORM** | 5.x | 类型安全的 ORM，自动生成 TypeScript 类型与 Migration，Schema 级多租户支持良好 |
| **Bull** | 4.x | Redis-backed 任务队列，适合审批超时提醒、异步通知发送 |
| **Socket.IO** | 4.x | WebSocket + 降级轮询，团队即时消息（F76）、实时通知推送 |
| **Class-Validator / Class-Transformer** | - | 装饰器式 DTO 验证与转换 |
| **JWT (jsonwebtoken)** | - | 无状态认证 |
| **Swagger / OpenAPI** | - | API 文档自动生成 |
| **Jest** | - | 单元测试 + E2E 测试 |

### 后端模块架构（NestJS Modules）

```
src/
├── auth/               # 认证模块（注册/登录/JWT/OAuth）
├── tenant/             # 租户管理模块（企业创建/配置/隔离）
├── user/               # 用户模块（个人资料/跨企业关联）
├── team/               # 团队模块（团队CRUD/成员管理/角色）
├── rbac/               # 权限模块（角色定义/权限矩阵/资源级权限）
├── task/               # 任务模块（CRUD/状态流转/子任务/关联）
├── board/              # 看板模块（列配置/拖拽排序/视图）
├── document/           # 文档模块（上传/预览/编辑/版本/搜索）
├── approval/           # 审批模块（模板/流程/审批操作）
├── notification/       # 通知模块（聚合/推送/偏好设置）
├── comment/            # 评论模块（任务评论/文档评论/@提及）
├── resource/           # 仓库资源模块（外部仓库接入/挂载）
├── milestone/          # 里程碑模块
├── message/            # 即时消息模块（WebSocket）
├── dashboard/          # 仪表盘模块（统计/图表数据）
├── graph/              # 资源图谱模块（关联查询/可视化数据）
├── audit/              # 审计日志模块
├── llm/                # 大模型集成模块（MCP/Skill/V2）
├── storage/            # 文件存储模块（MinIO/本地）
├── common/             # 公共模块（过滤器/拦截器/管道/装饰器）
└── config/             # 配置模块（环境变量/多环境）
```

## Data Storage

### 存储方案总览

| 存储类型 | 技术选型 | 用途 | 理由 |
|----------|----------|------|------|
| **主数据库** | PostgreSQL 16 | 所有业务数据：用户、租户、任务、文档、审批、权限等 | Schema 级多租户、JSONB、全文检索、ACID 事务 |
| **缓存** | Redis 7 | Session/Token 缓存、API 限流、通知队列、Socket.IO 适配器、Bull 任务队列 | 高性能内存存储，支持 Pub/Sub |
| **文件存储** | MinIO (S3兼容) | 附件、文档文件、图片、用户头像 | 自托管 S3，兼容 AWS S3 SDK |
| **消息队列** | Redis (Bull) | 异步任务：邮件发送、通知推送、审批超时检查 | 轻量级，无需额外引入 RabbitMQ |

### PostgreSQL 多租户方案：Schema 级隔离

选择 **Schema 级隔离**（每个租户一个独立 PostgreSQL Schema）的理由：

| 维度 | Database 级 | Schema 级（选择） | Row-level |
|------|-------------|-------------------|-----------|
| 隔离强度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 连接管理 | 复杂（多数据源） | 简单（单数据源切 schema） | 简单 |
| 跨租户查询 | 不可能 | 可跨 schema 查询 | 需额外隔离 |
| 迁移成本 | 高（需逐库执行） | 中（逐 schema 执行） | 低 |
| 共享表 | 不支持 | 支持（public schema 存共享数据） | 支持 |
| 备份粒度 | 逐库 | 逐 schema | 按行 |
| 资源池化 | 差 | 好（共享连接池） | 最好 |

**架构策略**：
- **共享表**（public schema）：平台级数据，如用户账号、租户注册信息
- **租户 Schema**（`t_<tenant_id>`）：每个租户一个 schema，包含该租户的所有业务表（任务、文档、团队、审批等）
- **连接时切换**：NestJS 中间件在请求到达时解析 `X-Tenant-Id` 头，动态设置 `SET search_path TO t_<tenant_id>, public`

```
           ┌──────────┐
           │  public   │ ← 共享表：users, tenants, etc.
           ├──────────┤
           │  t_10001  │ ← 租户A：tasks, documents, teams, etc.
           ├──────────┤
           │  t_10002  │ ← 租户B：tasks, documents, teams, etc.
           ├──────────┤
           │  t_10003  │ ← 租户C：tasks, documents, teams, etc.
           └──────────┘
```

### Redis 数据设计

| Key 模式 | 用途 | TTL |
|----------|------|-----|
| `session:<token>` | JWT 黑名单/Refresh Token | 7 天 |
| `rate:<ip>:<path>` | API 限流计数器 | 1 秒/1 分钟 |
| `ws:user:<userId>` | WebSocket 在线状态 | 心跳保活 |
| `queue:email` | 邮件发送队列 | - |
| `queue:notification` | 通知推送队列 | - |
| `cache:<key>` | 热点数据缓存（如租户配置） | 自定义 |
| `lock:<key>` | 分布式锁 | 30 秒 |

## System Components

### 分层架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │         React SPA (Vite + TypeScript + Ant Design)            │  │
│  │  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────────┐  │  │
│  │  │ Auth     │ │ Task    │ │ Document │ │ Collaboration   │  │  │
│  │  │ Pages    │ │ Module  │ │ Module   │ │ Graph / Chat    │  │  │
│  │  └──────────┘ └─────────┘ └──────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Nginx / Reverse Proxy                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │ SSL      │ │ Static   │ │ API Route│ │ WebSocket      │  │  │
│  │  │Termination│ │ Assets   │ │ /api/*   │ │ Proxy /ws/*    │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              NestJS Backend (Monolithic Deploy)                │  │
│  │                                                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ Auth     │ │ Tenant   │ │ RBAC     │ │ Audit            │  │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module           │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ Task     │ │ Board    │ │ Document │ │ Approval         │  │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module           │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │Comment   │ │Notify    │ │Dashboard │ │ Graph            │  │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module           │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │Message   │ │Milestone │ │ Resource │ │ LLM (V2)         │  │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module           │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                    │                                │
│                    ┌───────────────┴───────────────┐                │
│                    ▼                               ▼                │
│           ┌──────────────┐                ┌──────────────┐         │
│           │   Bull MQ    │                │  Socket.IO   │         │
│           │  (Async Jobs)│                │  (Real-time) │         │
│           └──────────────┘                └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │        MinIO             │  │
│  │  Schema:t_*  │  │   Cache/MQ   │  │     (File Storage)       │  │
│  │  public      │  │   Pub/Sub    │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 核心模块职责

| 模块 | 职责 | 阶段 |
|------|------|------|
| **Auth** | 注册/登录/登出、JWT 签发与验证、OAuth 预留、密码重置、登录限流 | 原型→V1 |
| **Tenant** | 企业注册、租户 Schema 自动创建、企业信息管理、冻结/注销 | 原型→V1→V2 |
| **User** | 用户个人资料、跨企业关联、密码加密 | 原型 |
| **Team** | 团队 CRUD、成员管理、角色分配、团队归档、可见性 | 原型→V1 |
| **RBAC** | 角色定义（owner/admin/leader/member/reader/guest）、权限矩阵、资源级权限覆盖 | V1 |
| **Task** | 任务 CRUD、状态流转、指派/转派、子任务、关联资源、筛选排序、批量操作、模板 | 原型→V1→V2 |
| **Board** | 看板列配置、泳道、拖拽排序、列表/甘特图/月历视图数据 | 原型→V1 |
| **Document** | 文件夹组织、上传/预览/编辑、全文检索、版本管理、分享链接 | 原型→V1→V2 |
| **Approval** | 审批模板配置、审批发起/流转/审批操作、进度跟踪、超时提醒 | 原型→V1→V2 |
| **Comment** | 评论/回复 CRUD、富文本、@提及、编辑/删除 | 原型→V1 |
| **Notification** | 通知聚合、未读/已读、分类筛选、跳转、偏好设置、邮件发送 | 原型→V1→V2 |
| **Message** | WebSocket 即时消息、历史搜索、已读状态 | V1→V2 |
| **Milestone** | 里程碑 CRUD、进度自动计算、预警 | V1→V2 |
| **Resource** | 外部仓库接入、目录浏览、资源挂载、变更通知 | V1→V2 |
| **Dashboard** | 企业/团队/个人统计数据、图表数据聚合 | 原型→V1 |
| **Graph** | 协作资源图谱数据聚合、关联查询、导出 | V1→V2 |
| **Audit** | 审计日志写入、查询、导出（仅追加） | V1 |
| **LLM** | 大模型 API 接入、MCP 协议适配、Skill 注册与执行、模型调用权限控制 | V2 |
| **Storage** | 文件上传/下载/预览签名 URL、文件类型检测 | 原型 |

## Data Model

### 核心 ER 图（文本描述）

```
users ──1:N── tenant_members ──N:1── tenants
  │                                      │
  │                                      │
  └──1:N── task_comments                  │
  └──1:N── approval_actions              │
  └──1:N── notifications                 │
  └──1:N── messages                      │
                                           │
teams ──N:1── tenant (schema)             │
  │                                       │
  ├──1:N── team_members ──N:1── users     │
  ├──1:N── tasks                          │
  │         ├── task_assignees ──N:1── users
  │         ├── task_comments              │
  │         ├── task_attachments           │
  │         ├── task_relations            │
  │         └── subtasks                  │
  ├──1:N── documents                      │
  │         ├── doc_versions              │
  │         └── doc_shares                │
  ├──1:N── approval_templates             │
  │         └── approval_nodes            │
  ├──1:N── approvals                      │
  │         └── approval_actions          │
  ├──1:N── milestones                     │
  │         └── milestone_tasks           │
  ├──1:N── board_columns                  │
  ├──1:N── messages                       │
  └──N:N── resources (via resource_links) │
                                           │
resource_repos ──N:1── tenant             │
  └──1:N── resource_items                 │
            └── resource_links            │
```

### 主要表结构（共享表 — public schema）

```sql
-- =============================================
-- 共享表（public schema）
-- =============================================

-- 用户账号（全局唯一）
CREATE TABLE public.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,       -- bcrypt/argon2
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | active | disabled | locked
    login_attempts  INT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 租户（企业）
CREATE TABLE public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name     VARCHAR(63) UNIQUE NOT NULL,   -- PostgreSQL schema name: t_<id>
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,   -- URL 友好标识
    industry        VARCHAR(100),
    scale           VARCHAR(20),                     -- 1-10 | 10-50 | 50-200 | 200+
    logo_url        VARCHAR(500),
    owner_id        UUID NOT NULL REFERENCES public.users(id),
    status          VARCHAR(20) DEFAULT 'active',   -- active | frozen | deleted
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 用户-租户关联（一个用户可属于多个企业）
CREATE TABLE public.tenant_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    user_id         UUID NOT NULL REFERENCES public.users(id),
    role            VARCHAR(20) NOT NULL DEFAULT 'member', -- owner | admin | leader | member | reader | guest
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);
```

### 主要表结构（租户 Schema — `t_<tenant_id>`）

所有租户 Schema 中的表结构相同，通过 `search_path` 切换。

```sql
-- =============================================
-- 租户 Schema 公共结构（t_<tenant_id>）
-- =============================================

-- 团队
CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    visibility      VARCHAR(20) DEFAULT 'public',  -- public | private
    is_archived     BOOLEAN DEFAULT FALSE,
    created_by      UUID NOT NULL,  -- reference to public.users.id
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 团队成员
CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,  -- reference to public.users.id
    role            VARCHAR(20) DEFAULT 'member',  -- leader | member | reader
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- 任务
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) DEFAULT 'todo',  -- todo | in_progress | done | closed
    priority        VARCHAR(10) DEFAULT 'medium',  -- urgent | high | medium | low
    due_date        DATE,
    parent_task_id  UUID REFERENCES tasks(id),  -- 子任务
    sort_order      FLOAT DEFAULT 0,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 任务负责人
CREATE TABLE task_assignees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    UNIQUE(task_id, user_id)
);

-- 任务标签
CREATE TABLE task_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    color           VARCHAR(7)  -- hex color
);

-- 任务关联资源（任务-文档 / 任务-仓库资源）
CREATE TABLE task_relations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    resource_type   VARCHAR(30) NOT NULL,  -- document | resource_item | task
    resource_id     UUID NOT NULL,
    relation_type   VARCHAR(30) DEFAULT 'related'  -- related | blocked_by | duplicate_of
);

-- 看板列配置
CREATE TABLE board_columns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    status          VARCHAR(30) NOT NULL,  -- 映射到 task.status
    sort_order      INT DEFAULT 0,
    color           VARCHAR(7)
);

-- 文档/文件夹
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES documents(id),  -- 文件夹层级
    name            VARCHAR(500) NOT NULL,
    type            VARCHAR(20) DEFAULT 'file',  -- file | folder
    file_path       VARCHAR(1000),               -- MinIO 路径
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    is_archived     BOOLEAN DEFAULT FALSE,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 文档版本
CREATE TABLE doc_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    file_path       VARCHAR(1000),
    file_size       BIGINT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- 文档分享
CREATE TABLE doc_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    share_token     VARCHAR(64) UNIQUE NOT NULL,
    access_code     VARCHAR(10),           -- 访问码（可选）
    permission      VARCHAR(20) DEFAULT 'view',  -- view | edit | comment
    expires_at      TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 审批模板
CREATE TABLE approval_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES teams(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    scope           VARCHAR(20) DEFAULT 'team',  -- enterprise | team
    form_fields     JSONB,               -- 自定义表单字段定义
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 审批节点
CREATE TABLE approval_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    sort_order      INT NOT NULL,
    approver_type   VARCHAR(20) DEFAULT 'single',  -- single | all | any
    approver_ids    UUID[] NOT NULL,    -- 审批人列表
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 审批实例
CREATE TABLE approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES approval_templates(id),
    team_id         UUID NOT NULL REFERENCES teams(id),
    title           VARCHAR(500) NOT NULL,
    form_data       JSONB,              -- 表单填写内容
    status          VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected | canceled
    current_node_id UUID REFERENCES approval_nodes(id),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- 审批操作记录
CREATE TABLE approval_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id     UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    node_id         UUID NOT NULL REFERENCES approval_nodes(id),
    action          VARCHAR(20) NOT NULL,  -- approve | reject | redirect
    comment         TEXT,
    operated_by     UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 评论
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   VARCHAR(30) NOT NULL,  -- task | document
    resource_id     UUID NOT NULL,
    parent_id       UUID REFERENCES comments(id),  -- 回复
    content         TEXT NOT NULL,
    is_edited       BOOLEAN DEFAULT FALSE,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 通知
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    type            VARCHAR(30) NOT NULL,  -- task_assigned | comment_mention | approval_need | etc.
    title           VARCHAR(500) NOT NULL,
    content         TEXT,
    resource_type   VARCHAR(30),
    resource_id     UUID,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 里程碑
CREATE TABLE milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    due_date        DATE,
    status          VARCHAR(20) DEFAULT 'active',  -- active | completed | overdue
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 里程碑-任务关联
CREATE TABLE milestone_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id    UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(milestone_id, task_id)
);

-- 仓库资源接入
CREATE TABLE resource_repos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(30) NOT NULL,  -- git | s3 | custom
    config          JSONB NOT NULL,       -- 仓库连接配置
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 仓库资源条目
CREATE TABLE resource_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES resource_repos(id) ON DELETE CASCADE,
    path            VARCHAR(1000) NOT NULL,
    name            VARCHAR(500) NOT NULL,
    type            VARCHAR(20) DEFAULT 'file',  -- file | dir
    size            BIGINT,
    metadata        JSONB,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 资源关联（任务/文档 ↔ 仓库资源）
CREATE TABLE resource_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_item_id UUID NOT NULL REFERENCES resource_items(id) ON DELETE CASCADE,
    target_type     VARCHAR(30) NOT NULL,  -- task | document
    target_id       UUID NOT NULL,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 审计日志（租户 Schema 内）
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    action          VARCHAR(50) NOT NULL,  -- create_task | delete_document | update_role | etc.
    resource_type   VARCHAR(30),
    resource_id     UUID,
    detail          JSONB,                -- 操作详情
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 资源图谱边（关系持久化）
CREATE TABLE graph_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     VARCHAR(30) NOT NULL,  -- task | document | member | resource_item
    source_id       UUID NOT NULL,
    target_type     VARCHAR(30) NOT NULL,
    target_id       UUID NOT NULL,
    relation_type   VARCHAR(30) DEFAULT 'related',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_type, source_id, target_type, target_id, relation_type)
);

-- 即时消息
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL,
    content         TEXT NOT NULL,
    message_type    VARCHAR(20) DEFAULT 'text',  -- text | system
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 消息已读状态
CREATE TABLE message_reads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    read_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);
```

## API and Integration Design

### API 风格

选择 **RESTful API**（符合 NF17 要求），理由：

| 对比项 | RESTful | GraphQL |
|--------|---------|---------|
| 学习成本 | 低，通用标准 | 中，需学习 Schema 语言 |
| 缓存策略 | 成熟（HTTP 缓存/CDN） | 复杂（需自定义） |
| 工具链 | 丰富（Postman, Swagger） | 较成熟 |
| 多租户场景 | 路径/Header 携带租户 ID | 需在 Context 中传递 |
| 文件上传 | 标准 multipart | 需要额外处理 |
| 团队熟悉度 | 高 | 中 |

### API 版本策略

- **URL 路径版本化**：`/api/v1/tasks`
- 版本号递增规则：MAJOR 版本仅在有破坏性变更时递增
- 每个版本维护至少一个次要版本的兼容期
- 通过 NestJS 模块级版本控制实现多版本共存

### 核心 API 端点设计

```
# 认证
POST   /api/v1/auth/register                     # 注册
POST   /api/v1/auth/activate                      # 激活
POST   /api/v1/auth/login                         # 登录
POST   /api/v1/auth/logout                        # 登出
POST   /api/v1/auth/refresh                       # 刷新 Token
POST   /api/v1/auth/forgot-password               # 忘记密码 (V1)
POST   /api/v1/auth/reset-password                # 重置密码 (V1)

# 租户/企业
POST   /api/v1/tenants                            # 创建企业
GET    /api/v1/tenants/:tenantId                  # 获取企业信息
PATCH  /api/v1/tenants/:tenantId                  # 更新企业信息
GET    /api/v1/tenants/:tenantId/members          # 获取成员列表
POST   /api/v1/tenants/:tenantId/invitations      # 邀请成员

# 团队
GET    /api/v1/teams                              # 当前企业的团队列表
POST   /api/v1/teams                              # 创建团队
GET    /api/v1/teams/:teamId                      # 团队详情
PATCH  /api/v1/teams/:teamId                      # 更新团队
DELETE /api/v1/teams/:teamId                      # 归档团队 (V1)
GET    /api/v1/teams/:teamId/members              # 团队成员
POST   /api/v1/teams/:teamId/members              # 添加成员
DELETE /api/v1/teams/:teamId/members/:userId      # 移除成员
PATCH  /api/v1/teams/:teamId/members/:userId      # 修改角色

# 任务
GET    /api/v1/tasks                              # 任务列表（分页/筛选/排序）
POST   /api/v1/tasks                              # 创建任务
GET    /api/v1/tasks/:taskId                      # 任务详情
PATCH  /api/v1/tasks/:taskId                      # 更新任务
DELETE /api/v1/tasks/:taskId                      # 删除任务
POST   /api/v1/tasks/:taskId/assignees            # 指派
POST   /api/v1/tasks/batch                        # 批量操作 (V1)
GET    /api/v1/tasks/:taskId/relations            # 关联资源
POST   /api/v1/tasks/:taskId/relations            # 添加关联

# 看板
GET    /api/v1/teams/:teamId/board                # 看板数据（按列分组）
PUT    /api/v1/teams/:teamId/board/columns        # 更新列配置
PATCH  /api/v1/tasks/:taskId/position             # 拖拽更新位置

# 文档
GET    /api/v1/documents                          # 文档列表（树形）
POST   /api/v1/documents                          # 上传文档/创建文件夹
GET    /api/v1/documents/:docId                   # 文档详情
PATCH  /api/v1/documents/:docId                   # 更新文档/移动
DELETE /api/v1/documents/:docId                   # 删除文档
GET    /api/v1/documents/:docId/versions          # 版本列表 (V2)
POST   /api/v1/documents/:docId/share             # 创建分享链接
GET    /api/v1/documents/search?q=                # 全文检索 (V1)

# 审批
GET    /api/v1/approvals                          # 审批列表
POST   /api/v1/approvals                          # 发起审批
GET    /api/v1/approvals/:approvalId              # 审批详情
POST   /api/v1/approvals/:approvalId/actions      # 审批操作（通过/拒绝）
GET    /api/v1/approval-templates                 # 审批模板列表
POST   /api/v1/approval-templates                 # 创建模板 (V1)

# 评论
GET    /api/v1/comments?resourceType=&resourceId= # 评论列表
POST   /api/v1/comments                           # 发表评论
PATCH  /api/v1/comments/:commentId                # 编辑评论 (V1)
DELETE /api/v1/comments/:commentId                # 删除评论 (V1)

# 通知
GET    /api/v1/notifications                      # 通知列表
PATCH  /api/v1/notifications/:id/read             # 标记已读
POST   /api/v1/notifications/read-all             # 全部已读
PATCH  /api/v1/notifications/settings             # 通知偏好 (V1)

# 消息 (V1)
GET    /api/v1/teams/:teamId/messages             # 消息历史
WS     /ws/chat/:teamId                           # WebSocket 消息

# 里程碑 (V1)
GET    /api/v1/milestones                         # 里程碑列表
POST   /api/v1/milestones                         # 创建里程碑
GET    /api/v1/milestones/:milestoneId            # 里程碑详情（含进度）

# 仓库资源 (V1)
POST   /api/v1/resource-repos                     # 接入仓库
GET    /api/v1/resource-repos/:repoId/browse      # 浏览目录
POST   /api/v1/resource-links                     # 挂载资源

# 仪表盘
GET    /api/v1/dashboard/enterprise               # 企业概览 (V1)
GET    /api/v1/dashboard/team/:teamId             # 团队统计 (V1)
GET    /api/v1/dashboard/user                     # 个人统计

# 资源图谱 (V1)
GET    /api/v1/graph/:resourceType/:resourceId    # 获取关联图谱数据

# 审计日志 (V1)
GET    /api/v1/audit-logs                         # 审计日志查询
POST   /api/v1/audit-logs/export                  # 审计日志导出

# LLM/AI (V2)
POST   /api/v1/llm/chat                           # 模型对话
POST   /api/v1/llm/skills/:skillId/execute        # 执行 Skill
GET    /api/v1/llm/mcp/tools                      # MCP 工具列表

# 系统
GET    /api/v1/health                             # 健康检查
```

### 通用 API 规范

**请求头**：
```
X-Tenant-Id: <tenant_slug_or_id>   # 租户标识
Authorization: Bearer <jwt_token>   # 认证
X-Request-Id: <uuid>               # 请求追踪 (NF33)
```

**响应格式**：
```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "requestId": "req-uuid"
  }
}
```

**错误格式**：
```json
{
  "code": 40100,
  "message": "Unauthorized: token expired",
  "details": { ... },
  "requestId": "req-uuid"
}
```

**错误码规范**：
```
4xxxx - 客户端错误
  401xx - 认证错误
  403xx - 权限错误
  404xx - 资源不存在
  422xx - 参数校验失败
  429xx - 频率限制
5xxxx - 服务端错误
```

## Security and Privacy

### 认证架构 (JWT)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │ 1.登录  │  Auth    │ 2.验证   │  Database│
│  (React) │ ──────> │  Service │ ──────> │  (users) │
│          │         │          │         │          │
│          │ 3.返回   │          │         │          │
│          │ <────── │  JWT     │         │          │
│          │         │ (Access  │         │          │
│          │         │ +Refresh)│         │          │
└──────────┘         └──────────┘         └──────────┘
     │ 4.API请求
     │ Header:
     │ Authorization: Bearer <access_token>
     │ X-Tenant-Id: <tenant_id>
     ▼
┌─────────────────────────────────────────────┐
│           NestJS Global Guards              │
│  ┌──────────────────────────────────────┐   │
│  │ 1. JwtAuthGuard                     │   │
│  │    - 验证 Token 签名 & 过期          │   │
│  │    - 解析 payload (userId, role)     │   │
│  ├──────────────────────────────────────┤   │
│  │ 2. TenantGuard                      │   │
│  │    - 验证 X-Tenant-Id 合法性         │   │
│  │    - 验证用户是否属于该租户           │   │
│  │    - 设置 search_path               │   │
│  ├──────────────────────────────────────┤   │
│  │ 3. RbacGuard                        │   │
│  │    - 验证角色是否满足接口要求         │   │
│  │    - 资源级权限二次校验               │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Token 策略**：
| Token 类型 | 有效期 | 存储 | 用途 |
|-----------|--------|------|------|
| Access Token | 15 分钟 | 内存 (Zustand) | API 认证 |
| Refresh Token | 7 天 | httpOnly Cookie | 静默刷新 |
| Share Token | 自定义 | 数据库 | 文档/任务分享 |

### 授权架构 (RBAC)

**角色层级**：
```
Owner (企业) → Admin (企业) → Leader (团队) → Member (团队) → Reader (团队)
                                                                   ↓
                                                              Guest (外部)
```

**权限矩阵（简化）**：

| 操作 | Owner | Admin | Leader | Member | Reader | Guest |
|------|-------|-------|--------|--------|--------|-------|
| 企业管理设置 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 团队创建 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 团队管理 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 任务创建 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 任务编辑/删除 | ✅ | ✅ | ✅ | 本人 | ❌ | ❌ |
| 任务查看 | ✅ | ✅ | ✅ | ✅ | ✅ | 授权 |
| 文档上传 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 文档编辑 | ✅ | ✅ | ✅ | ✅ | ❌ | 授权 |
| 文档查看 | ✅ | ✅ | ✅ | ✅ | ✅ | 授权 |
| 发起审批 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 审批操作 | ✅ | ✅ | 按节点 | 按节点 | ❌ | ❌ |
| 审计日志 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 成员管理 | ✅ | ✅ | 本团队 | ❌ | ❌ | ❌ |

**资源级权限覆盖**：通过 `doc_shares` 表实现，资源级权限 > 角色级默认权限。

**NestJS 实现**：
```typescript
// 自定义装饰器
@Rbac('task', 'delete')        // 需要 task:delete 权限
@ResourceAccess('document')     // 需要文档级权限校验

// Guards 链式执行
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
```

### 安全防护措施

| 防护项 | 措施 | 对应需求 |
|--------|------|----------|
| 暴力登录防御 | Redis 计数器 + 临时锁定 (5次/15分钟) | F07 |
| XSS 防护 | 输出编码 (React 默认)；CSP Header | NF31 |
| CSRF 防护 | SameSite=Strict Cookie；Double Submit Cookie | NF31 |
| SQL 注入 | Prisma 参数化查询（ORM 层天然防护） | NF31 |
| 密码存储 | bcrypt (cost=12) / argon2id | NF27 |
| 防重放 | Timestamp + Nonce 机制（敏感接口） | NF28 |
| 租户隔离 | Schema 级隔离 + 中间件强制校验 | F84, NF30 |
| 审计日志不可篡改 | 仅追加写入，无 UPDATE/DELETE API | NF32 |
| 文件安全 | 类型白名单校验、病毒扫描（预留） | - |
| HTTPS | Nginx 层强制 TLS 1.3 | NF26 |

### 审计日志

```typescript
// 审计日志切面（NestJS Interceptor）
@AuditLog('create_task', {
  resourceType: 'task',
  extractDetail: (req, body) => ({
    title: body.title,
    teamId: body.teamId,
  })
})
```

**记录范围**（F85）：
- 登录/登出（成功与失败）
- 用户创建/删除/角色变更
- 资源创建/更新/删除（任务、文档、团队、审批）
- 权限变更
- 租户设置变更
- 审计日志本身不可删除/修改

## Performance and Reliability

### 性能策略

| 场景 | 策略 | 对应需求 |
|------|------|----------|
| API 响应 ≤ 500ms (P95) | N+1 查询预防（Prisma include/raw query）、Redis 缓存热点数据、数据库索引优化 | NF02 |
| 任务列表 ≤ 1s (1000条) | 分页查询 (cursor-based)、覆盖索引、JSONB 索引 | NF04 |
| 首屏加载 ≤ 3s | 代码分割 (React.lazy)、Tree Shaking、CDN 静态资源、Gzip/Brotli 压缩 | NF01 |
| 200 并发无 5xx | 连接池配置 (pg-pool max=20)、NestJS 异步非阻塞、Redis 限流 | NF03 |
| 通知推送 ≤ 5s | WebSocket 实时推送 + Bull 队列降级 | NF06 |
| 文件上传 ≤ 50MB | 分片上传（V2）、MinIO 直传签名 URL、类型与大小预检 | NF05 |

### 索引策略

```sql
-- 核心索引（所有租户 schema 通用）
CREATE INDEX idx_tasks_team_status ON tasks(team_id, status);
CREATE INDEX idx_tasks_assignee ON task_assignees(user_id, task_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE status IN ('todo', 'in_progress');
CREATE INDEX idx_documents_team_parent ON documents(team_id, parent_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_comments_resource ON comments(resource_type, resource_id);
CREATE INDEX idx_messages_team_created ON messages(team_id, created_at DESC);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_type, source_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_type, target_id);

-- 全文检索索引 (V1)
CREATE INDEX idx_documents_fts ON documents USING GIN(to_tsvector('simple', name || ' ' || COALESCE(content, '')));
```

### 可靠性策略

| 场景 | 策略 |
|------|------|
| 数据库备份 | pg_dump 每日全量备份 (cron)，保留 7 天 (NF08)；WAL 日志连续归档 |
| 幂等性 | 关键接口支持 Idempotency-Key 头（创建任务、发起审批）(NF10) |
| 优雅降级 | LLM 不可用时返回友好提示(NF09)；文件预览降级为下载链接 |
| 健康检查 | `/api/v1/health` 返回 DB、Redis、MinIO 连接状态 (NF35) |
| 慢查询日志 | PostgreSQL log_min_duration_statement = 1000ms (NF36) |
| 错误处理 | 全局 ExceptionFilter 捕获异常，返回统一错误格式 (NF09) |

## 大模型集成架构 (V2)

### MCP (Model Context Protocol) 扩展架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                        LLM / AI Module                               │
│                                                                      │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │ LLM Auth   │  │ Model Router   │  │ Context Builder        │    │
│  │ & Rate     │  │ (OpenAI/国产)   │  │ (收集租户上下文)        │    │
│  │ Limiter    │  │                │  │                        │    │
│  └────────────┘  └────────────────┘  └────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                   MCP Protocol Layer                        │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │     │
│  │  │ Tool Registry │ │ Resource     │ │ Prompt Manager   │   │     │
│  │  │ (Skill 注册)  │ │ Descriptor   │ │ (预设 Prompt)    │   │     │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                   Built-in Skills                           │     │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ │     │
│  │  │ Auto       │ │ Weekly     │ │ Task       │ │ Smart  │ │     │
│  │  │ Summary    │ │ Report Gen │ │ Suggestion │ │ Search │ │     │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────┘ │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

**权限控制**：
- 模型调用严格遵循租户隔离（F91）
- 每个 Skill 声明所需权限范围（如 `task:read`、`document:list`）
- 模型调用前通过 RbacGuard 校验
- 模型访问数据通过专门的 MCP Context Builder 构建，仅返回授权的上下文

**MCP 工具示例**：
```typescript
// 工具注册
{
  name: 'create_task',
  description: '在指定团队创建任务',
  parameters: {
    type: 'object',
    properties: {
      teamId: { type: 'string' },
      title: { type: 'string' },
      assigneeId: { type: 'string', optional: true },
    }
  },
  requiredPermission: 'task:create',
  handler: async (params, context) => {
    // context.tenantId, context.userId 由框架注入
    return taskService.create({ ...params, tenantId: context.tenantId });
  }
}
```

## 协作资源图谱架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Graph Module                                │
│                                                                  │
│  1. GraphBuilder Service                                        │
│     输入: resourceType + resourceId                             │
│     输出: { nodes: [...], edges: [...] }                        │
│     数据来源: task_relations, resource_links, comments,          │
│               team_members 等多表联合查询                       │
│                                                                  │
│  2. GraphEdge 表（预计算）                                       │
│     - 写入时机: 创建/更新关联关系时同步写入                     │
│     - 读: 直接查询 graph_edges 表（快）                         │
│     - 写: 通过事务保证一致性                                     │
│                                                                  │
│  3. 前端渲染: React Flow                                          │
│     - 节点: 任务、文档、成员、资源                               │
│     - 边: 关联/创建/负责/引用等关系                              │
│     - 交互: 点击跳转、缩放、筛选                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 多租户架构设计（补充）

### Schema 级隔离实现细节

**租户创建流程**：
```
POST /api/v1/tenants
  → 1. 在 public.tenants 中插入记录
  → 2. 生成唯一 schema_name: t_<uuid_short>
  → 3. 执行 CREATE SCHEMA IF NOT EXISTS t_<uuid_short>
  → 4. 在租户 schema 中执行迁移（运行所有 CREATE TABLE）
  → 5. 创建 Owner 的 tenant_members 记录
  → 6. 设置 search_path = t_<uuid_short>, public
  → 7. 返回租户信息
```

**中间件实现**：
```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new UnauthorizedException('Missing tenant');

    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    // 设置 Prisma 的 schema
    req.tenantSchema = tenant.schema_name;
    // 通过 CLS (Continuation Local Storage) 传递 schema
    PrismaTenant.setSchema(tenant.schema_name);

    next();
  }
}
```

### 数据隔离边界

| 数据类别 | 存储位置 | 隔离级别 |
|----------|----------|----------|
| 用户账号 (email/password) | public.users | 全局共享 |
| 租户信息 | public.tenants | 全局共享 |
| 用户-租户关联 | public.tenant_members | 按行隔离 |
| 业务数据 (task/doc/team) | t_<id>.tasks/docs/teams | Schema 级隔离 |
| 审计日志 | t_<id>.audit_logs | Schema 级隔离 |
| 文件存储 | MinIO Bucket: `t-<id>` | Bucket 级隔离 |
| 缓存 | Redis Key: `t_<id>:<key>` | Key 前缀隔离 |

## Project Structure

```
saas-collaboration-platform/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                       # CI: lint, test, build
│       └── cd.yml                       # CD: docker build & deploy
│
├── packages/
│   ├── shared-types/                    # 共享类型定义（前后端共用）
│   │   ├── src/
│   │   │   ├── enums/                   # 枚举：TaskStatus, Priority, etc.
│   │   │   ├── interfaces/              # 接口：IUser, ITask, ITeam etc.
│   │   │   └── constants/               # 常量：角色、权限列表
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                        # React SPA
│   │   ├── public/
│   │   │   └── favicon.ico
│   │   ├── src/
│   │   │   ├── main.tsx                 # 入口
│   │   │   ├── App.tsx                  # 根组件（Provider 嵌套）
│   │   │   ├── router/
│   │   │   │   ├── index.tsx            # 路由配置
│   │   │   │   ├── guards.tsx           # 路由守卫（AuthGuard、TenantGuard）
│   │   │   │   └── routes.ts            # 路由定义常量
│   │   │   ├── layouts/
│   │   │   │   ├── RootLayout.tsx       # 整体布局（Sidebar + Header + Outlet）
│   │   │   │   ├── AuthLayout.tsx       # 登录/注册布局
│   │   │   │   └── TeamLayout.tsx       # 团队空间布局（Tabs/子导航）
│   │   │   ├── pages/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginPage.tsx
│   │   │   │   │   ├── RegisterPage.tsx
│   │   │   │   │   ├── ActivatePage.tsx
│   │   │   │   │   └── ResetPasswordPage.tsx
│   │   │   │   ├── tenant/
│   │   │   │   │   ├── SelectTenantPage.tsx
│   │   │   │   │   ├── CreateTenantPage.tsx
│   │   │   │   │   └── TenantSettingsPage.tsx
│   │   │   │   ├── team/
│   │   │   │   │   ├── TeamDashboard.tsx
│   │   │   │   │   ├── TeamSettings.tsx
│   │   │   │   │   └── TeamMembers.tsx
│   │   │   │   ├── task/
│   │   │   │   │   ├── TaskListPage.tsx
│   │   │   │   │   ├── TaskDetailPage.tsx
│   │   │   │   │   ├── BoardPage.tsx
│   │   │   │   │   ├── GanttPage.tsx
│   │   │   │   │   └── CalendarPage.tsx
│   │   │   │   ├── document/
│   │   │   │   │   ├── DocumentCenterPage.tsx
│   │   │   │   │   ├── DocumentPreviewPage.tsx
│   │   │   │   │   └── DocumentEditorPage.tsx
│   │   │   │   ├── approval/
│   │   │   │   │   ├── ApprovalListPage.tsx
│   │   │   │   │   ├── ApprovalDetailPage.tsx
│   │   │   │   │   └── ApprovalTemplatePage.tsx
│   │   │   │   ├── notification/
│   │   │   │   │   └── NotificationCenterPage.tsx
│   │   │   │   ├── message/
│   │   │   │   │   └── TeamChatPage.tsx
│   │   │   │   ├── milestone/
│   │   │   │   │   └── MilestonePage.tsx
│   │   │   │   ├── graph/
│   │   │   │   │   └── ResourceGraphPage.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── DashboardPage.tsx
│   │   │   │   └── user/
│   │   │   │       ├── ProfilePage.tsx
│   │   │   │       └── UserStatsPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── common/              # 通用组件
│   │   │   │   │   ├── Loading.tsx
│   │   │   │   │   ├── EmptyState.tsx
│   │   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   │   ├── SearchInput.tsx
│   │   │   │   │   └── Pagination.tsx
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Breadcrumb.tsx
│   │   │   │   │   └── ThemeToggle.tsx
│   │   │   │   ├── task/
│   │   │   │   │   ├── TaskCard.tsx
│   │   │   │   │   ├── TaskForm.tsx
│   │   │   │   │   ├── TaskFilter.tsx
│   │   │   │   │   ├── TaskAssignPopover.tsx
│   │   │   │   │   └── KanbanColumn.tsx
│   │   │   │   ├── document/
│   │   │   │   │   ├── DocTreeNode.tsx
│   │   │   │   │   ├── DocUploader.tsx
│   │   │   │   │   ├── DocPreview.tsx
│   │   │   │   │   └── ShareDialog.tsx
│   │   │   │   ├── approval/
│   │   │   │   │   ├── ApprovalTimeline.tsx
│   │   │   │   │   ├── ApprovalForm.tsx
│   │   │   │   │   └── TemplateBuilder.tsx
│   │   │   │   ├── comment/
│   │   │   │   │   ├── CommentList.tsx
│   │   │   │   │   └── CommentInput.tsx
│   │   │   │   ├── notification/
│   │   │   │   │   └── NotificationBell.tsx
│   │   │   │   ├── graph/
│   │   │   │   │   ├── ResourceGraph.tsx
│   │   │   │   │   └── GraphNode.tsx
│   │   │   │   └── member/
│   │   │   │       ├── MemberAvatar.tsx
│   │   │   │       ├── MemberSelect.tsx
│   │   │   │       └── RoleTag.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useTenant.ts
│   │   │   │   ├── useTasks.ts
│   │   │   │   ├── useDocuments.ts
│   │   │   │   ├── useNotifications.ts
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   ├── usePermission.ts
│   │   │   │   └── useDebounce.ts
│   │   │   ├── stores/
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── uiStore.ts
│   │   │   │   └── workspaceStore.ts
│   │   │   ├── services/
│   │   │   │   ├── api.ts              # Axios 实例配置
│   │   │   │   ├── authService.ts
│   │   │   │   ├── taskService.ts
│   │   │   │   ├── documentService.ts
│   │   │   │   ├── approvalService.ts
│   │   │   │   ├── notificationService.ts
│   │   │   │   ├── messageService.ts
│   │   │   │   └── dashboardService.ts
│   │   │   ├── utils/
│   │   │   │   ├── format.ts           # 日期/数字格式化
│   │   │   │   ├── permission.ts       # 权限判断工具
│   │   │   │   └── validators.ts       # 表单校验规则
│   │   │   ├── types/
│   │   │   │   └── index.ts            # 前端专用类型（extends shared-types）
│   │   │   └── styles/
│   │   │       ├── global.css
│   │   │       ├── variables.css       # CSS 变量（主题色）
│   │   │       └── antd-overrides.css  # Ant Design 主题覆盖
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── backend/                         # NestJS Backend
│       ├── prisma/
│       │   ├── schema.prisma            # Prisma Schema（所有表定义）
│       │   ├── migrations/              # 数据库迁移
│       │   └── seeds/                   # 种子数据
│       ├── src/
│       │   ├── main.ts                  # 应用入口
│       │   ├── app.module.ts            # 根模块
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   ├── current-tenant.decorator.ts
│       │   │   │   ├── rbac.decorator.ts
│       │   │   │   └── audit-log.decorator.ts
│       │   │   ├── guards/
│       │   │   │   ├── jwt-auth.guard.ts
│       │   │   │   ├── tenant.guard.ts
│       │   │   │   └── rbac.guard.ts
│       │   │   ├── interceptors/
│       │   │   │   ├── audit-log.interceptor.ts
│       │   │   │   ├── tenant.interceptor.ts
│       │   │   │   ├── logging.interceptor.ts
│       │   │   │   └── transform.interceptor.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   ├── pipes/
│       │   │   │   └── validation.pipe.ts
│       │   │   ├── middleware/
│       │   │   │   └── tenant.middleware.ts
│       │   │   └── utils/
│       │   │       ├── pagination.ts
│       │   │       └── idempotency.ts
│       │   ├── config/
│       │   │   ├── database.config.ts
│       │   │   ├── redis.config.ts
│       │   │   ├── storage.config.ts
│       │   │   ├── jwt.config.ts
│       │   │   └── llm.config.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.guard.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   └── jwt-refresh.strategy.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── register.dto.ts
│       │   │   │   │   ├── login.dto.ts
│       │   │   │   │   └── reset-password.dto.ts
│       │   │   │   └── auth.controller.spec.ts
│       │   │   ├── tenant/
│       │   │   │   ├── tenant.module.ts
│       │   │   │   ├── tenant.controller.ts
│       │   │   │   ├── tenant.service.ts
│       │   │   │   ├── tenant.provision.service.ts  # Schema 创建
│       │   │   │   └── dto/
│       │   │   ├── user/
│       │   │   │   ├── user.module.ts
│       │   │   │   ├── user.controller.ts
│       │   │   │   ├── user.service.ts
│       │   │   │   └── dto/
│       │   │   ├── team/
│       │   │   │   ├── team.module.ts
│       │   │   │   ├── team.controller.ts
│       │   │   │   ├── team.service.ts
│       │   │   │   ├── dto/
│       │   │   │   └── team.controller.spec.ts
│       │   │   ├── task/
│       │   │   │   ├── task.module.ts
│       │   │   │   ├── task.controller.ts
│       │   │   │   ├── task.service.ts
│       │   │   │   ├── dto/
│       │   │   │   └── tasks.gateway.ts  # WebSocket 事件
│       │   │   ├── board/
│       │   │   │   ├── board.module.ts
│       │   │   │   ├── board.controller.ts
│       │   │   │   ├── board.service.ts
│       │   │   │   └── dto/
│       │   │   ├── document/
│       │   │   │   ├── document.module.ts
│       │   │   │   ├── document.controller.ts
│       │   │   │   ├── document.service.ts
│       │   │   │   ├── document-search.service.ts
│       │   │   │   └── dto/
│       │   │   ├── approval/
│       │   │   │   ├── approval.module.ts
│       │   │   │   ├── approval.controller.ts
│       │   │   │   ├── approval.service.ts
│       │   │   │   ├── approval-template.service.ts
│       │   │   │   ├── approval-engine.service.ts  # 审批流转引擎
│       │   │   │   └── dto/
│       │   │   ├── comment/
│       │   │   │   ├── comment.module.ts
│       │   │   │   ├── comment.controller.ts
│       │   │   │   ├── comment.service.ts
│       │   │   │   └── dto/
│       │   │   ├── notification/
│       │   │   │   ├── notification.module.ts
│       │   │   │   ├── notification.controller.ts
│       │   │   │   ├── notification.service.ts
│       │   │   │   ├── notification.gateway.ts     # WebSocket
│       │   │   │   ├── notification.processor.ts   # Bull 队列消费者
│       │   │   │   └── dto/
│       │   │   ├── message/
│       │   │   │   ├── message.module.ts
│       │   │   │   ├── message.controller.ts
│       │   │   │   ├── message.service.ts
│       │   │   │   ├── message.gateway.ts          # WebSocket Chat
│       │   │   │   └── dto/
│       │   │   ├── milestone/
│       │   │   │   ├── milestone.module.ts
│       │   │   │   ├── milestone.controller.ts
│       │   │   │   ├── milestone.service.ts
│       │   │   │   └── dto/
│       │   │   ├── resource/
│       │   │   │   ├── resource.module.ts
│       │   │   │   ├── resource.controller.ts
│       │   │   │   ├── resource.service.ts
│       │   │   │   └── dto/
│       │   │   ├── dashboard/
│       │   │   │   ├── dashboard.module.ts
│       │   │   │   ├── dashboard.controller.ts
│       │   │   │   └── dashboard.service.ts
│       │   │   ├── graph/
│       │   │   │   ├── graph.module.ts
│       │   │   │   ├── graph.controller.ts
│       │   │   │   └── graph.service.ts
│       │   │   ├── audit/
│       │   │   │   ├── audit.module.ts
│       │   │   │   ├── audit.controller.ts
│       │   │   │   └── audit.service.ts
│       │   │   ├── storage/
│       │   │   │   ├── storage.module.ts
│       │   │   │   ├── storage.service.ts
│       │   │   │   └── storage.controller.ts
│       │   │   └── llm/                            # V2
│       │   │       ├── llm.module.ts
│       │   │       ├── llm.controller.ts
│       │   │       ├── llm.service.ts
│       │   │       ├── mcp/
│       │   │       │   ├── mcp.protocol.ts
│       │   │       │   ├── mcp.tool-registry.ts
│       │   │       │   └── mcp.context-builder.ts
│       │   │       └── skills/
│       │   │           ├── skill.registry.ts
│       │   │           ├── summary.skill.ts
│       │   │           ├── weekly-report.skill.ts
│       │   │           └── task-suggestion.skill.ts
│       │   └── prisma/
│       │       ├── prisma.module.ts
│       │       ├── prisma.service.ts               # Schema 动态切换
│       │       └── prisma-tenant.service.ts         # 租户 Schema 封装
│       ├── test/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── .env.example
│       ├── .env.test
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── package.json
│       ├── Dockerfile
│       └── docker-compose.yml                      # 多服务编排
│
├── docker-compose.yml                               # 根目录编排（含全部服务）
├── .gitignore
├── .env.example
├── LICENSE
└── README.md
```

## File Responsibilities

### 关键文件职责映射

| 文件路径 | 职责 | 归属 |
|----------|------|------|
| `packages/shared-types/src/enums/` | 前后端共享枚举定义（TaskStatus, Priority, Role 等） | 共享 |
| `packages/frontend/src/main.tsx` | React 应用入口，挂载 Router + QueryClient + Provider | 前端 |
| `packages/frontend/src/App.tsx` | 根组件，组织 Provider 层级：Auth → Tenant → Query → Router | 前端 |
| `packages/frontend/src/router/index.tsx` | 集中式路由配置，定义路径与页面组件的映射关系 | 前端 |
| `packages/frontend/src/router/guards.tsx` | AuthGuard: 未登录跳转登录页；TenantGuard: 未选企业跳选择页 | 前端 |
| `packages/frontend/src/layouts/RootLayout.tsx` | 主布局：Sidebar + Header + 内容区 Outlet | 前端 |
| `packages/frontend/src/stores/authStore.ts` | 认证状态：Token、当前用户、登录/登出动作 | 前端 |
| `packages/frontend/src/stores/workspaceStore.ts` | 工作空间状态：当前企业、当前团队 | 前端 |
| `packages/frontend/src/services/api.ts` | Axios 实例：基础 URL、拦截器（Token注入/租户ID/错误处理） | 前端 |
| `packages/frontend/src/hooks/useTasks.ts` | TanStack Query hook: 任务列表 CRUD 操作封装 | 前端 |
| `packages/frontend/src/components/task/TaskCard.tsx` | 看板任务卡片组件：标题、负责人、优先级、标签 | 前端 |
| `packages/frontend/src/components/task/KanbanColumn.tsx` | 看板列组件：dnd-kit 拖拽区域 | 前端 |
| `packages/frontend/src/components/graph/ResourceGraph.tsx` | React Flow 资源图谱可视化组件 | 前端 |
| `packages/frontend/vite.config.ts` | Vite 构建配置：代理、代码分割、CSS 变量 | 前端 |
| `packages/frontend/Dockerfile` | Nginx 静态托管 + SPA 路由重写 | 部署 |
| `packages/backend/prisma/schema.prisma` | Prisma 数据模型定义（所有表 + 关系 + 索引） | 后端 |
| `packages/backend/src/main.ts` | NestJS 启动入口：Swagger 配置、全局管道/过滤器/拦截器 | 后端 |
| `packages/backend/src/app.module.ts` | 根模块：导入所有业务模块 | 后端 |
| `packages/backend/src/common/guards/jwt-auth.guard.ts` | JWT Token 验证守卫 | 后端 |
| `packages/backend/src/common/guards/tenant.guard.ts` | 租户校验守卫 + search_path 设置 | 后端 |
| `packages/backend/src/common/guards/rbac.guard.ts` | RBAC 权限校验守卫（读取权限矩阵） | 后端 |
| `packages/backend/src/common/interceptors/audit-log.interceptor.ts` | 审计日志自动记录（装饰器驱动） | 后端 |
| `packages/backend/src/common/filters/http-exception.filter.ts` | 全局异常过滤器，统一错误响应格式 | 后端 |
| `packages/backend/src/modules/auth/auth.service.ts` | 认证核心逻辑：密码验证、JWT 签发/刷新/撤销 | 后端 |
| `packages/backend/src/modules/tenant/tenant.service.ts` | 租户 CRUD + Schema 创建/迁移 | 后端 |
| `packages/backend/src/modules/tenant/tenant.provision.service.ts` | 新租户 Schema 自动创建与初始化配置 | 后端 |
| `packages/backend/src/modules/task/task.service.ts` | 任务 CRUD + 子任务 + 关联 + 批量操作 | 后端 |
| `packages/backend/src/modules/board/board.service.ts` | 看板列配置 + 任务分组 + 排序更新 | 后端 |
| `packages/backend/src/modules/document/document.service.ts` | 文档上传/预览/编辑/版本管理 | 后端 |
| `packages/backend/src/modules/document/document-search.service.ts` | 全文检索实现（PostgreSQL FTS） | 后端 |
| `packages/backend/src/modules/approval/approval-engine.service.ts` | 审批流转引擎：节点推进/会签/或签/超时 | 后端 |
| `packages/backend/src/modules/notification/notification.service.ts` | 通知创建 + 推送（WebSocket/Bull） | 后端 |
| `packages/backend/src/modules/notification/notification.processor.ts` | Bull 队列消费者：邮件发送/WebSocket 推送 | 后端 |
| `packages/backend/src/modules/message/message.gateway.ts` | WebSocket 网关：聊天消息实时传输 | 后端 |
| `packages/backend/src/modules/graph/graph.service.ts` | 资源图谱关联查询与数据聚合 | 后端 |
| `packages/backend/src/modules/storage/storage.service.ts` | MinIO/S3 上传/下载/签名 URL 生成 | 后端 |
| `packages/backend/src/modules/audit/audit.service.ts` | 审计日志仅追加写入 + 查询 | 后端 |
| `packages/backend/src/modules/llm/llm.service.ts` | 大模型 API 调用封装 | 后端 |
| `packages/backend/src/modules/llm/mcp/mcp.tool-registry.ts` | MCP 工具注册中心 | 后端 |
| `packages/backend/src/modules/llm/mcp/mcp.context-builder.ts` | 模型上下文构建（租户数据聚合） | 后端 |
| `packages/backend/src/modules/llm/skills/skill.registry.ts` | Skill 注册与执行引擎 | 后端 |
| `packages/backend/src/prisma/prisma.service.ts` | Prisma Client 封装 + Schema 动态切换 | 后端 |
| `packages/backend/docker-compose.yml` | PostgreSQL + Redis + MinIO + App 本地开发编排 | 部署 |

## Tradeoffs and Alternatives

| 决策点 | 选型 | 替代方案 | 权衡分析 |
|--------|------|----------|----------|
| **前端框架** | React 18 + TypeScript | Vue 3 + Element Plus | React 生态更成熟（React Flow, dnd-kit），团队如熟悉 Vue 可替换。两者在此场景均可 |
| **后端框架** | NestJS + Node.js | Java Spring Boot / Go Gin | Node.js 与前端共享 TypeScript 类型，开发效率高；但 CPU 密集型场景不如 Go/Java。适合 IO 密集型企业协作场景 |
| **数据库** | PostgreSQL 16 | MySQL 8+ | PG Schema 天然支持多租户隔离，JSONB 支持灵活字段，全文检索能力强于 MySQL。NF25 明确建议 PG |
| **多租户方案** | Schema 级隔离 | Database 级 / Row-level | Schema 级平衡了隔离强度与运维复杂度。Database 级连接管理过于复杂，Row-level 风险较高 |
| **ORM** | Prisma | TypeORM / Drizzle | Prisma 类型安全最佳，Migration 工具成熟，Schema 文件作为单一事实来源；但复杂查询需用 raw query |
| **状态管理** | Zustand + React Query | Redux Toolkit / MobX | Zustand 轻量无 boilerplate，React Query 专门处理服务端状态，避免重复手写 loading/error 状态 |
| **文件存储** | MinIO (S3) | 本地文件系统 | 本地文件系统无法水平扩展，备份困难。MinIO 提供 S3 兼容 API，易于扩展但需要额外部署 |
| **审批流程** | 线性节点配置 | BPMN 标准引擎 | 线性审批简单可维护，满足需求；BPMN 过度设计。约束已明确（6.1） |
| **API风格** | RESTful | GraphQL | RESTful 符合 NF17，学习成本低，缓存友好。GraphQL 在资源图谱场景有优势，但整体复杂度收益不高 |
| **大模型接入** | MCP 协议 + Skill 插件 | 直接 API 调用 | MCP 提供标准化协议，方便切换模型供应商；插件化 Skill 便于团队扩展。但 V2 阶段，前期只需预留接口 |
| **部署** | Docker Compose | Kubernetes | 中小规模团队，Docker Compose 足够；K8s 运维成本高。V2 可按需迁移 |
| **部门模块** | 单仓库 (Monorepo) | 多仓库 | 单仓库便于共享类型、统一 CI/CD、原子提交；但随着规模增大构建时间会增加 |

## Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Schema 级多租户导致迁移管理复杂 | 中 | 高 | 使用 Prisma Migration 逐 schema 执行；编写自动化迁移脚本；先在小租户验证 |
| 审批引擎线性模型无法满足复杂场景 | 低 | 中 | V1 严格限定为线性审批；V2 按需扩展分支支持 |
| 文件预览兼容性差 | 中 | 中 | 使用成熟库（Office Online / KKFileView）；不支持的格式提供下载提示 |
| LLM API 延迟高、成本不可控 | 高 | 中 | V2 阶段引入；预置缓存与熔断；限制频率与 Token 消耗 |
| WebSocket 连接数随并发增长 | 中 | 中 | 使用 Redis 适配器水平扩展 Socket.IO；200 并发场景单体足够 |
| 前端包体积过大（Ant Design + React Flow） | 中 | 低 | 按需加载（Ant Design 已支持 Tree Shaking）；React.lazy + Suspense 代码分割 |

## Open Questions

| 序号 | 问题 | 影响 | 建议决策 |
|------|------|------|----------|
| Q01 | 文件预览使用哪家方案？自建预览还是接入 Office Online / Google Docs Viewer？ | 影响 V1 文档预览实现成本 | 建议使用 `@microsoft/office-viewer` 或商业方案 KKFileView，本地部署 |
| Q02 | 大模型接入具体使用哪家 API？（OpenAI / 通义千问 / 文心一言） | 影响 V2 LLM 模块 SDK 选型 | 建议 MCP 协议抽象层，支持多供应商切换，默认对接 OpenAI 兼容接口 |
| Q03 | 即时消息是否需要消息漫游（跨设备同步）？ | 影响消息存储与同步方案 | V1 仅 Web 端，不做消息漫游，V2 评估 |
| Q04 | 是否需要软删除（deleted_at）还是物理删除？ | 影响所有资源删除的数据库设计 | 建议增加 `deleted_at` 软删除字段，保留数据可恢复性，审计日志记录删除操作 |
| Q05 | 是否需要定时任务自动清理过期分享链接和未激活账号？ | 影响后台任务设计 | 建议 V1 实现 Bull 定时任务（每日清理） |
| Q06 | 是否需要支持 LDAP/企业微信/钉钉 SSO 登录？ | 影响 Auth 模块设计 | 建议 V2 阶段作为 OAuth 扩展点接入 |

## Suggested Next Step

建议按照以下顺序推进实施：

1. **Phase 0 — 基础设施搭建（1-2 天）**
   - 初始化 Monorepo 结构（pnpm workspace）
   - 配置前端 Vite + React + Ant Design + TypeScript
   - 配置后端 NestJS + Prisma + PostgreSQL
   - 编写 docker-compose.yml（PG + Redis + MinIO）
   - 配置 ESLint + Prettier + Husky + commitlint

2. **Phase 1 — 原型展示阶段（3-5 天）**
   - 实现前端登录/注册/激活页面（F01-F04）
   - 实现企业创建页（F08, F10）
   - 实现团队管理页（F18, F19）
   - 实现任务 CRUD + 看板拖拽（F28-F31, F36, F37）
   - 实现文档中心 + 评论附件（F46, F47, F52, F41-F43）
   - 实现审批发起 + 进度查看（F53, F57）
   - 实现通知中心（F67-F69）
   - 实现邀请成员（F13-F14）
   - 后端提供 mock 数据或基础 API

3. **Phase 2 — V1 后端补齐（5-7 天）**
   - 完善认证模块（F05, F07）
   - 租户 Schema 自动开通 + 中间件（F09）
   - RBAC 完整实现 + 资源级权限（F23-F27）
   - 任务增强：子任务、关联、批量操作（F32, F33, F35）
   - 甘特图/月历视图（F38-F40）
   - 文档在线预览 + 编辑（F48, F49, F51）
   - 审批完整流程（F54-F56）
   - 资源图谱（F59-F61）
   - 仓库资源接入（F63-F65）
   - 里程碑（F72-F74）
   - 即时消息（F76, F77）
   - 仪表盘（F80-F82）
   - 审计日志（F85, F86）
   - 安全防护全面落地（F84, F87）

4. **Phase 3 — V2 能力增强（视课程进度）**
   - 大模型集成 + MCP + Skill（F88-F91）
   - OAuth 第三方登录（F06）
   - 文档版本管理（F50）
   - 审批超时提醒（F58）
   - 站外邮件通知（F71）
   - 深色模式（NF21）
