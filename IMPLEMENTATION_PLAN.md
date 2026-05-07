# Implementation Plan: SaaS多租户企业协作平台

> 基于 REQUIREMENTS.md（91条需求，3阶段）和 ARCHITECTURE.md（React 18 + NestJS + PostgreSQL + Prisma + Redis + MinIO）覆盖重写。

---

## Inputs

| 文档 | 路径 | 说明 |
|------|------|------|
| REQUIREMENTS.md | `./REQUIREMENTS.md` | 91条功能需求，分原型/V1/V2三阶段，6类用户角色，36条非功能需求 |
| ARCHITECTURE.md | `./ARCHITECTURE.md` | 前后端技术栈、18个业务模块、25+核心表、80+API端点、Schema级多租户隔离 |

## Planning Assumptions

| # | 假设 |
|---|------|
| A1 | 技术栈锁定：React 18 + Ant Design 5 + Zustand + React Query（前端），NestJS 10 + Prisma 5 + PostgreSQL 16（后端） |
| A2 | 多租户采用 Schema 级隔离，Prisma 通过 dynamic schema 切换 |
| A3 | Monorepo 使用 pnpm workspace，目录结构 `packages/shared-types/`, `packages/frontend/`, `packages/backend/` |
| A4 | 原型阶段先完成后端 API 再构建前端页面；V1 补齐完整后端 + 增强前端；V2 引入 AI |
| A5 | 不开发国际化、移动端原生 App、BPMN 级审批、开放 API |
| A6 | 文件存储使用 MinIO（本地开发 S3 兼容） |
| A7 | 所有后端 API 版本化为 `/api/v1/` |
| A8 | 团队即时消息使用 WebSocket（Socket.IO）+ Redis Adapter |
| A9 | 工作目录为空，无已有代码 |

## Build Order

```
Phase 0 — Infrastructure (3 tasks): T-01 → {T-02, T-03}
Phase 1 — Prototype (18 tasks):
  DB:     T-04
  BE:     T-05 → T-06 → T-07 → {T-08, T-11} → T-09 → {T-10, T-12}
  FE:     T-13 → {T-14, T-15} → T-16 → {T-17, T-18, T-19} → {T-20, T-21}
Phase 2 — V1 (27 tasks):
  BE:     T-22 → {T-23, T-24} → T-25 → {T-26, T-27} → T-28 → ... → T-36
  FE:     T-37 → {T-38, T-39} → {T-40,T-41,T-42} → {T-43,T-44,T-45} → {T-46,T-47} → T-48
Phase 3 — V2 (3 tasks): T-49 → T-50 → T-51
```

## Execution Batches

```
Batch    Tasks                  Strategy    Phase    Notes
───────  ─────────────────────  ─────────  ───────  ──────────────────────────────────
B1       T-01                   serial     Infra    Foundation: shared-types package
B2       T-02, T-03             parallel   Infra    Backend + Frontend scaffold
B3       T-04                   serial     Proto    Database schema (strict prerequisite)
B4       T-05                   serial     Proto    Backend common layer
B5       T-06                   serial     Proto    Auth backend
B6       T-07                   serial     Proto    Tenant+Team backend
B7       T-08, T-11             parallel   Proto    Task+Board + Approval backend
B8       T-09                   serial     Proto    Comment+Storage (needs T-08)
B9       T-10, T-12             parallel   Proto    Document + Notification backend
B10      T-13                   serial     Proto    Frontend API layer + state
B11      T-14, T-15             parallel   Proto    Auth pages + Layout/Router
B12      T-16                   serial     Proto    Tenant+Team frontend pages
B13      T-17, T-18, T-19       parallel   Proto    Task+Board-Document-Approval pages
B14      T-20, T-21             parallel   Proto    Comment+Notification + User Stats
B15      T-22                   serial     V1       RBAC backend
B16      T-23, T-24             parallel   V1       Auth + Tenant/Team enhancement
B17      T-25                   serial     V1       Task enhancement
B18      T-26, T-27             parallel   V1       Board + Comment enhancement
B19      T-28                   serial     V1       Document enhancement
B20      T-29                   serial     V1       Approval enhancement
B21      T-30                   serial     V1       Resource module
B22      T-31                   serial     V1       Milestone module
B23      T-32                   serial     V1       Message module
B24      T-33                   serial     V1       Dashboard enhancement
B25      T-34                   serial     V1       Graph module
B26      T-35                   serial     V1       Audit module
B27      T-36                   serial     V1       Security & Isolation
B28      T-37                   serial     V1       Frontend RBAC
B29      T-38, T-39             parallel   V1       Auth + Team enhancement pages
B30      T-40, T-41, T-42       parallel   V1       Task+Board+Document enhancement UI
B31      T-43, T-44, T-45       parallel   V1       Approval+Graph+Milestone UI
B32      T-46, T-47             parallel   V1       Chat + Dashboard UI
B33      T-48                   serial     V1       Audit log UI
B34      T-49                   serial     V2       LLM backend
B35      T-50                   serial     V2       V2 backend enhancements
B36      T-51                   serial     V2       V2 frontend enhancements
```

## Task Breakdown

### Phase 0 — Infrastructure

#### T-01: Monorepo + Shared Types
| Field | Value |
|-------|-------|
| **ID** | T-01 |
| **Owner** | `fullstack` |
| **Phase** | Infrastructure |
| **Goal** | Initialize pnpm workspace monorepo, create `packages/shared-types` with shared enums (TaskStatus, Priority, Role, etc.), interfaces (IUser, ITask, ITeam, IDocument, IApproval, IComment, INotification, etc.), constants (permission matrix) |
| **Files To Create** | `pnpm-workspace.yaml`, `package.json` (root), `tsconfig.base.json`, `.gitignore`, `.npmrc`, `packages/shared-types/package.json`, `tsconfig.json`, `src/enums/index.ts`, `src/interfaces/index.ts`, `src/constants/index.ts`, `src/index.ts` |
| **Steps** | 1. Create root pnpm-workspace.yaml + package.json with workspace scripts (build, lint, test); 2. Create shared tsconfig.base.json; 3. Create shared-types package; 4. Define all shared enums (TaskStatus, Priority, Role, ApprovalStatus, NotificationType, ResourceType), interfaces (IUser, ITenant, ITeam, ITeamMember, ITask, IDocument, IApproval, IComment, INotification, IMilestone, IMessage), constants; 5. Verify TypeScript compilation |
| **Verification** | `pnpm install` succeeds; `pnpm --filter shared-types build` outputs dist; types importable in both frontend and backend |
| **Depends On** | none |
| **Requirements Ref** | REQUIREMENTS.md §3 (all roles and statuses) |
| **Architecture Ref** | ARCHITECTURE.md §Project Structure, §File Responsibilities |

#### T-02: Backend Scaffold (NestJS + Prisma + Docker)
| Field | Value |
|-------|-------|
| **ID** | T-02 |
| **Owner** | `backend` |
| **Phase** | Infrastructure |
| **Goal** | Initialize NestJS backend project with Prisma ORM, Docker Compose (PostgreSQL 16 + Redis 7 + MinIO), environment config |
| **Files To Create** | `packages/backend/package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.env.example`, `.env`, `src/main.ts`, `src/app.module.ts`, `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`, `prisma/schema.prisma` (empty skeleton), `docker-compose.yml` (backend), `Dockerfile`, root `docker-compose.yml` |
| **Steps** | 1. Create package.json with all NestJS deps (@nestjs/core, @nestjs/common, @nestjs/jwt, @nestjs/passport, class-validator, class-transformer, etc.) + Prisma deps; 2. Create NestJS entry main.ts (Swagger + global pipes); 3. Create app.module.ts (empty); 4. Create PrismaModule + PrismaService; 5. Create empty schema.prisma skeleton; 6. Create docker-compose.yml (PG 16 + Redis 7 + MinIO); 7. Create .env.example |
| **Verification** | `pnpm --filter backend build` succeeds; `docker-compose up -d` starts three services; `pnpm --filter backend start:dev` starts NestJS |
| **Depends On** | T-01 |
| **Architecture Ref** | ARCHITECTURE.md §Backend Stack, §Data Storage, §Project Structure |

#### T-03: Frontend Scaffold (Vite + React + Ant Design)
| Field | Value |
|-------|-------|
| **ID** | T-03 |
| **Owner** | `frontend` |
| **Phase** | Infrastructure |
| **Goal** | Initialize React SPA with Vite, TypeScript, Ant Design 5, React Router v6, Zustand, TanStack React Query, Axios, dnd-kit, React Flow (optional), CSS variables |
| **Files To Create** | `packages/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/styles/global.css`, `variables.css`, `antd-overrides.css`, `src/types/index.ts`, `Dockerfile` |
| **Steps** | 1. Create package.json with all frontend deps; 2. Configure Vite (proxy /api to backend, path aliases, code splitting); 3. Create main.tsx entry (mount React); 4. Create App.tsx (Provider nesting: AuthProvider → QueryClientProvider → RouterProvider); 5. Create CSS styles (global, CSS variables for theming, Ant Design overrides); 6. Create frontend-specific types extending shared-types |
| **Verification** | `pnpm --filter frontend dev` starts Vite dev server; browser shows empty Ant Design page with no console errors |
| **Depends On** | T-01 |
| **Architecture Ref** | ARCHITECTURE.md §Frontend Stack, §Project Structure, §URL State |

### Phase 1 — Prototype MVP — Backend

#### T-04: Prisma Complete Data Model
| Field | Value |
|-------|-------|
| **ID** | T-04 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Write complete Prisma schema covering public schema tables (users, tenants, tenant_members) and tenant schema tables (teams, team_members, tasks, task_assignees, task_tags, task_relations, board_columns, documents, doc_versions, doc_shares, approval_templates, approval_nodes, approvals, approval_actions, comments, notifications, milestones, milestone_tasks, resource_repos, resource_items, resource_links, audit_logs, graph_edges, messages, message_reads) — 25+ tables with indexes, relations, enums |
| **Files To Modify** | `packages/backend/prisma/schema.prisma` (full implementation) |
| **Steps** | 1. Define Prisma generator + datasource (postgresql); 2. Define enums (TaskStatus, Priority, Role, ApprovalStatus, NotificationType, ResourceType, TeamVisibility, DocumentType, MessageType); 3. Define shared models (User, Tenant, TenantMember) with @@schema("public"); 4. Define all tenant-scoped models with proper relations and indexes; 5. Run prisma generate + db push |
| **Verification** | `npx prisma generate` succeeds; `npx prisma db push` creates all tables in local PostgreSQL; generated TypeScript types accessible in @prisma/client |
| **Depends On** | T-02 |
| **Architecture Ref** | ARCHITECTURE.md §Data Model (all SQL DDL), §索引策略 |

#### T-05: Backend Common Layer (Guards/Interceptors/Filters/Middleware)
| Field | Value |
|-------|-------|
| **ID** | T-05 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Build NestJS common infrastructure: JWT auth guard, tenant guard, global exception filter, logging interceptor, response transform interceptor, audit log decorator (skeleton), validation pipe, pagination helper, config modules |
| **Files To Create** | `src/common/decorators/current-user.decorator.ts`, `current-tenant.decorator.ts`, `rbac.decorator.ts` (skeleton), `audit-log.decorator.ts` (skeleton), `guards/jwt-auth.guard.ts`, `tenant.guard.ts`, `rbac.guard.ts` (skeleton), `interceptors/logging.interceptor.ts`, `transform.interceptor.ts`, `filters/http-exception.filter.ts`, `pipes/validation.pipe.ts`, `middleware/tenant.middleware.ts`, `utils/pagination.ts`, `utils/idempotency.ts`, `config/database.config.ts`, `config/jwt.config.ts`, `config/redis.config.ts`, `config/storage.config.ts` |
| **Steps** | 1. Implement JwtAuthGuard (verify JWT signature + expiry, parse payload); 2. Implement TenantGuard (parse X-Tenant-Id, validate tenant existence, set search_path — basic version); 3. Implement RbacGuard skeleton (pass-all, full impl in V1); 4. Implement HttpExceptionFilter (unified {code, message, details, requestId} format); 5. Implement LoggingInterceptor (method/URL/duration/tenantId/userId); 6. Implement TransformInterceptor (wrap response as {code, message, data, meta}); 7. Implement CurrentUser/CurrentTenant decorators; 8. Implement ValidationPipe wrapper; 9. Implement PaginationHelper; 10. Register all global pipes/filters/interceptors in main.ts |
| **Verification** | NestJS starts without errors; no-token request returns 401; requests with valid token return correct unified response format; error responses follow {code, message, details, requestId} |
| **Depends On** | T-04 |
| **Architecture Ref** | ARCHITECTURE.md §Security and Privacy, §通用 API 规范, §API 响应格式 |

#### T-06: Backend Auth Module (F01-F04)
| Field | Value |
|-------|-------|
| **ID** | T-06 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | User registration (email/phone), account activation (simulated email with activation code), password login, email verification code login, logout, JWT token issuance & refresh (Access Token 15min + Refresh Token 7d) |
| **Files To Create** | `modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `strategies/jwt.strategy.ts`, `jwt-refresh.strategy.ts`, `dto/register.dto.ts`, `login.dto.ts`, `activate.dto.ts`, `modules/user/user.module.ts`, `user.controller.ts`, `user.service.ts` |
| **Files To Modify** | `app.module.ts` (register AuthModule, UserModule) |
| **Steps** | 1. AuthService.register() — validate uniqueness, bcrypt password, create user (status=pending), generate activation code; 2. AuthService.activate() — verify activation code, update status=active; 3. AuthService.login() — validate credentials, issue Access Token (15min) + Refresh Token (7d); 4. AuthService.logout() — add token to blacklist (Redis); 5. AuthService.refresh() — verify Refresh Token, issue new Access Token; 6. Implement Passport JWT + JWT-Refresh strategies; 7. Implement UserService (profile view/update); 8. Implement all controller endpoints |
| **API Endpoints** | `POST /api/v1/auth/register`, `/activate`, `/login`, `/logout`, `/refresh` |
| **Verification** | Register→Activate→Login→Get Token→Access protected endpoint→Logout→Token invalid; `pnpm --filter backend test` runs unit tests |
| **Depends On** | T-05 |
| **Requirements Ref** | REQUIREMENTS.md §3.1 (F01-F04) |
| **Architecture Ref** | ARCHITECTURE.md §认证架构 (JWT), §核心 API 端点设计 |

#### T-07: Backend Tenant & Team Module (F08,F10,F18,F19,F13,F14)
| Field | Value |
|-------|-------|
| **ID** | T-07 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Enterprise/tenant creation with auto-appoint Owner, team CRUD, team member management (add/remove/role change), member invitation by email/link |
| **Files To Create** | `modules/tenant/tenant.module.ts`, `tenant.controller.ts`, `tenant.service.ts`, `dto/create-tenant.dto.ts`, `modules/team/team.module.ts`, `team.controller.ts`, `team.service.ts`, `dto/create-team.dto.ts`, `dto/add-member.dto.ts` |
| **Files To Modify** | `app.module.ts` (register TenantModule, TeamModule) |
| **Steps** | 1. TenantService.create() — create tenant record + add creator as Owner in tenant_members; 2. TenantService.findById() / getMembers(); 3. TeamService.create() — create team within tenant; 4. TeamService.findById() / update() / delete(); 5. TeamService.addMember() / removeMember() / updateMemberRole(); 6. Invitation logic (create invitation record, accept→join team); 7. Implement all API endpoints |
| **API Endpoints** | `POST/GET /api/v1/tenants`, `GET /api/v1/tenants/:id/members`, `POST /api/v1/tenants/:id/invitations`, `GET/POST /api/v1/teams`, `GET/PATCH/DELETE /api/v1/teams/:id`, `GET/POST/DELETE /api/v1/teams/:id/members/:userId` |
| **Verification** | Create enterprise→auto become Owner→create team→add member→member visible; all endpoints return correct status codes and data |
| **Depends On** | T-06 |
| **Requirements Ref** | REQUIREMENTS.md §3.2 (F08,F10), §3.3 (F13,F14), §3.4 (F18,F19) |
| **Architecture Ref** | ARCHITECTURE.md §核心模块职责 (Tenant, Team) |

#### T-08: Backend Task & Board Module (F28-F31,F36,F37)
| Field | Value |
|-------|-------|
| **ID** | T-08 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Task CRUD, status flow (todo→in_progress→done→closed), assign/reassign, filter/sort (by status/priority/assignee/due_date), kanban column config, board grouping data, drag-drop position update |
| **Files To Create** | `modules/task/task.module.ts`, `task.controller.ts`, `task.service.ts`, `dto/create-task.dto.ts`, `update-task.dto.ts`, `query-task.dto.ts`, `modules/board/board.module.ts`, `board.controller.ts`, `board.service.ts`, `dto/update-column.dto.ts` |
| **Files To Modify** | `app.module.ts` (register TaskModule, BoardModule) |
| **Steps** | 1. TaskService.create() — title, description, optional assignee, due_date, priority, tags; 2. TaskService.findAll() — paginated, filter/sort by status/priority/assignee/due_date; 3. TaskService.findById() / update() / delete(); 4. TaskService.assign() / transfer(); 5. Status flow validation (prevent invalid transitions); 6. BoardService.getBoard() — group tasks by kanban columns; 7. BoardService.updateColumnConfig() — configure column name, status mapping, sort_order; 8. BoardService.updateTaskPosition() — update status + sort_order after drag; 9. Implement all API endpoints |
| **API Endpoints** | `GET/POST /api/v1/tasks`, `GET/PATCH/DELETE /api/v1/tasks/:taskId`, `POST /api/v1/tasks/:taskId/assignees`, `GET /api/v1/teams/:teamId/board`, `PUT /api/v1/teams/:teamId/board/columns`, `PATCH /api/v1/tasks/:taskId/position` |
| **Verification** | Create task→assign→filter/sort→kanban grouping→drag to change status→board refreshes; paginated results correct |
| **Depends On** | T-07 |
| **Requirements Ref** | REQUIREMENTS.md §3.6 (F28-F31), §3.7 (F36,F37) |

#### T-09: Backend Comment & Storage Module (F41-F43)
| Field | Value |
|-------|-------|
| **ID** | T-09 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Task/document comments (rich text, @mentions), file upload/download/delete with type/size validation, MinIO/local storage |
| **Files To Create** | `modules/comment/comment.module.ts`, `comment.controller.ts`, `comment.service.ts`, `dto/create-comment.dto.ts`, `modules/storage/storage.module.ts`, `storage.service.ts`, `storage.controller.ts` |
| **Files To Modify** | `app.module.ts` (register CommentModule, StorageModule) |
| **Steps** | 1. CommentService.create() — resourceType(task/doc) + resourceId, rich text content; 2. CommentService.findByResource() — paginated by resource; 3. CommentService.delete() — owner-only; 4. @mention parsing + notification trigger (placeholder, full impl in V1); 5. StorageService.upload() — file type/size validation, store to MinIO (local file fallback for dev); 6. StorageService.getDownloadUrl() — signed URL; 7. StorageService.delete(); 8. Implement all API endpoints |
| **API Endpoints** | `GET/POST /api/v1/comments`, `DELETE /api/v1/comments/:commentId` |
| **Verification** | Upload file→comment on task→comment list displays content; uploaded file returns accessible URL; delete removes comment |
| **Depends On** | T-08 |
| **Requirements Ref** | REQUIREMENTS.md §3.8 (F41-F43) |

#### T-10: Backend Document Module (F46,F47,F52)
| Field | Value |
|-------|-------|
| **ID** | T-10 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Document center: folder tree hierarchy (parent_id), file upload (multiple formats: Office, PDF, images, text), share link generation with permission settings (view/edit/comment), access_code optional |
| **Files To Create** | `modules/document/document.module.ts`, `document.controller.ts`, `document.service.ts`, `dto/create-document.dto.ts`, `dto/share-document.dto.ts` |
| **Files To Modify** | `app.module.ts` (register DocumentModule) |
| **Steps** | 1. DocumentService.createFolder() / uploadFile() — support parent_id for folder hierarchy; 2. DocumentService.getTree() — return team document tree; 3. DocumentService.findById() / update() / delete(); 4. DocumentService.createShare() — generate share token, access_code, permission, expires_at; 5. DocumentService.getShareInfo() — access via share token; 6. Integrate with StorageService for file handling; 7. Implement all API endpoints |
| **API Endpoints** | `GET/POST /api/v1/documents`, `GET/PATCH/DELETE /api/v1/documents/:docId`, `POST /api/v1/documents/:docId/share` |
| **Verification** | Create folder→upload document→tree view→preview→generate share link→access via link |
| **Depends On** | T-09 |
| **Requirements Ref** | REQUIREMENTS.md §3.9 (F46,F47,F52) |

#### T-11: Backend Approval Module (F53,F57)
| Field | Value |
|-------|-------|
| **ID** | T-11 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Approval initiation (select template, fill form data), approval progress tracking (current node, processor), seed templates (leave, expense, general) |
| **Files To Create** | `modules/approval/approval.module.ts`, `approval.controller.ts`, `approval.service.ts`, `dto/create-approval.dto.ts`, `dto/query-approval.dto.ts` |
| **Files To Modify** | `app.module.ts` (register ApprovalModule) |
| **Steps** | 1. ApprovalService.create() — select template, fill form_data (JSONB), create approval instance; 2. ApprovalService.findAll() — filter by team/creator/status with pagination; 3. ApprovalService.findById() — detail with current node, processor list, action history; 4. Create seed approval templates (leave, expense, general); 5. Implement all API endpoints |
| **API Endpoints** | `GET/POST /api/v1/approvals`, `GET /api/v1/approvals/:approvalId`, `GET /api/v1/approval-templates` |
| **Verification** | Create approval→listed→detail shows current node and processor; seed templates available for selection |
| **Depends On** | T-07 |
| **Requirements Ref** | REQUIREMENTS.md §3.10 (F53,F57) |

#### T-12: Backend Notification & Dashboard Module (F67-F69,F82)
| Field | Value |
|-------|-------|
| **ID** | T-12 |
| **Owner** | `backend` |
| **Phase** | Prototype |
| **Goal** | Notification center: aggregation (task_assigned, comment_mention, approval_need etc.), unread/read, type filter, click-to-navigate; user personal statistics (total tasks, completion rate, pending count) |
| **Files To Create** | `modules/notification/notification.module.ts`, `notification.controller.ts`, `notification.service.ts`, `dto/query-notification.dto.ts`, `modules/dashboard/dashboard.module.ts`, `dashboard.controller.ts`, `dashboard.service.ts` |
| **Files To Modify** | `app.module.ts` (register NotificationModule, DashboardModule) |
| **Steps** | 1. NotificationService.create() — create notification (type, title, content, resource_type, resource_id); 2. NotificationService.findByUser() — paginated, type filter, unread/read; 3. NotificationService.markRead() / markAllRead(); 4. Notification trigger hooks — auto-create on task assign, comment @mention (synchronous basic version); 5. DashboardService.getUserStats() — total tasks, completion rate, pending tasks, overdue count; 6. Implement all API endpoints |
| **API Endpoints** | `GET/PATCH /api/v1/notifications`, `POST /api/v1/notifications/read-all`, `GET /api/v1/dashboard/user` |
| **Verification** | Assign task→assignee receives notification→list shows unread→mark read→click navigates to task; personal stats return correct data |
| **Depends On** | T-11 |
| **Requirements Ref** | REQUIREMENTS.md §3.13 (F67-F69), §3.16 (F82) |

### Phase 1 — Prototype MVP — Frontend

#### T-13: Frontend API Layer & State Management
| Field | Value |
|-------|-------|
| **ID** | T-13 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Axios instance with interceptors (Authorization Bearer Token, X-Tenant-Id, X-Request-Id, 401 auto-refresh), Zustand stores (authStore: token/user, workspaceStore: current org/team, uiStore: sidebar/theme/loading), React Query hooks skeleton for all data fetching |
| **Files To Create** | `services/api.ts`, `authService.ts`, `taskService.ts`, `documentService.ts`, `approvalService.ts`, `notificationService.ts`, `dashboardService.ts`, `messageService.ts`, `stores/authStore.ts`, `uiStore.ts`, `workspaceStore.ts`, `hooks/useAuth.ts`, `useTasks.ts`, `useDocuments.ts`, `useNotifications.ts`, `useTenant.ts`, `useWebSocket.ts`, `usePermission.ts`, `useDebounce.ts`, `utils/format.ts`, `permission.ts`, `validators.ts` |
| **Steps** | 1. Create Axios instance (baseURL, request interceptor for Auth/Token/TenantId, response interceptor for 401 auto-refresh + error handling); 2. Create all API service modules (authService, taskService, documentService, approvalService, notificationService, dashboardService, messageService); 3. Create authStore (token persistence to localStorage, user info, login/logout/refresh actions); 4. Create workspaceStore (current org, current team, org list); 5. Create uiStore (sidebar collapsed, theme mode placeholder, global loading); 6. Create React Query hooks (useAuth, useTasks, useDocuments, useNotifications, useTenant); 7. Create utility functions (date formatters, permission checkers, form validators) |
| **Verification** | Axios instance can make requests; Zustand stores read/write correctly; React Query hooks mount without errors |
| **Depends On** | T-03 |
| **Architecture Ref** | ARCHITECTURE.md §状态管理策略, §前端组件树 |

#### T-14: Frontend Auth Pages (F01-F04)
| Field | Value |
|-------|-------|
| **ID** | T-14 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Login page (password login, email verification code login placeholder), register page (email/phone + password + confirm), activation page (show activation code/link), auth layout (centered card with logo) |
| **Files To Create** | `pages/auth/LoginPage.tsx`, `RegisterPage.tsx`, `ActivatePage.tsx`, `layouts/AuthLayout.tsx` |
| **Files To Modify** | `router/index.tsx` (add auth routes: /auth/login, /auth/register, /auth/activate) |
| **Steps** | 1. Create AuthLayout (centered card, logo, title); 2. Create RegisterPage (email/phone + password + confirm form, on success→redirect to activation prompt); 3. Create ActivatePage (display activation code, activate button, calls API); 4. Create LoginPage (password login form, "forgot password" button placeholder, on success→redirect to org selection); 5. Configure React Router routes; 6. Implement form validation |
| **Verification** | Visit `/auth/login` shows login form; register→activation→login→successful redirect; all form validations fire correctly |
| **Depends On** | T-13 |
| **Requirements Ref** | REQUIREMENTS.md §3.1 (F01-F04) |
| **Architecture Ref** | ARCHITECTURE.md §路由设计 |

#### T-15: Frontend Layout & Router
| Field | Value |
|-------|-------|
| **ID** | T-15 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | RootLayout (Ant Design Layout: Sider with Sidebar, Header with user/notification/search, Content with Outlet, Breadcrumb), route configuration (React Router v6 nested routes, AuthGuard redirect to login, TenantGuard redirect to selection), common reusable components |
| **Files To Create** | `layouts/RootLayout.tsx`, `TeamLayout.tsx`, `components/layout/Sidebar.tsx`, `Header.tsx`, `Breadcrumb.tsx`, `components/common/Loading.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `ConfirmDialog.tsx`, `SearchInput.tsx`, `Pagination.tsx`, `router/index.tsx`, `guards.tsx`, `routes.ts` |
| **Steps** | 1. Create routes.ts (all route constant definitions); 2. Create guards.tsx (AuthGuard: no token→redirect /auth/login; TenantGuard: no org→redirect /); 3. Create router/index.tsx (React Router v6 nested route tree); 4. Create RootLayout (Ant Design Layout: Sider + Header + Content + Breadcrumb); 5. Create Sidebar (org/team switcher, navigation menu with task/docs/approval/messages/milestones items, phase-aware visibility); 6. Create Header (global search input, notification bell with unread badge, user avatar dropdown); 7. Create Breadcrumb (auto-generate from current route); 8. Create all common components; 9. Create TeamLayout (sub-navigation tabs within team context) |
| **Verification** | Route configuration complete and navigable; post-login redirects to org selection; post-org-selection enters dashboard layout; sidebar expand/collapse works; breadcrumb shows correct path |
| **Depends On** | T-13, T-14 |
| **Architecture Ref** | ARCHITECTURE.md §组件树, §路由设计 |

#### T-16: Frontend Tenant & Team Pages (F08,F10,F18,F19,F13,F14)
| Field | Value |
|-------|-------|
| **ID** | T-16 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Tenant selection page (card grid of orgs), create tenant page (form: name, industry, scale), team dashboard (org home showing team list), team settings (name, description), team members page (member list with role tags, add/remove, invite dialog by email or link) |
| **Files To Create** | `pages/tenant/SelectTenantPage.tsx`, `CreateTenantPage.tsx`, `pages/team/TeamDashboard.tsx`, `TeamSettings.tsx`, `TeamMembers.tsx`, `components/member/MemberAvatar.tsx`, `MemberSelect.tsx`, `RoleTag.tsx` |
| **Files To Modify** | `router/index.tsx` (add tenant/team routes) |
| **Steps** | 1. SelectTenantPage — card grid of user's orgs, click→enter org, "Create new" button; 2. CreateTenantPage — form with name, industry, scale; 3. TeamDashboard — org home showing team list cards; 4. TeamSettings — editable name, description; 5. TeamMembers — member table (avatar, name, role tag, remove button), invite dialog (email input or copy link); 6. Member components (MemberAvatar with fallback, MemberSelect in popover, RoleTag with color coding) |
| **Verification** | Login→select org→create org→auto-navigate to dashboard→create team→invite member→member appears with correct role tag |
| **Depends On** | T-15 |

#### T-17: Frontend Task & Board Pages (F28-F31,F36,F37)
| Field | Value |
|-------|-------|
| **ID** | T-17 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Task list (Ant Design Table with status/priority/assignee/due-date filter and sort), task detail (full info, status change, comment section area, attachment list), kanban board (dnd-kit drag-drop between columns to change status) |
| **Files To Create** | `pages/task/TaskListPage.tsx`, `TaskDetailPage.tsx`, `BoardPage.tsx`, `components/task/TaskCard.tsx`, `TaskForm.tsx`, `TaskFilter.tsx`, `TaskAssignPopover.tsx`, `KanbanColumn.tsx` |
| **Files To Modify** | `router/index.tsx` (add task routes: /org/:orgId/team/:teamId/tasks, /tasks/:taskId, /board) |
| **Steps** | 1. TaskListPage — Table view with filter bar (status, priority, assignee, due date), sortable columns; 2. TaskForm — create/edit modal (title, description, assignee, due date, priority, tags); 3. TaskDetailPage — full detail with status change buttons, tabs for comments and attachments; 4. BoardPage — dnd-kit DndContext with multiple KanbanColumn; 5. KanbanColumn — droppable area, column header, task cards list; 6. TaskCard — card with title, priority badge, assignee avatar, due date; 7. TaskFilter — quick filter chips + advanced filter modal; 8. TaskAssignPopover — member selector popover |
| **Verification** | Create task→visible in list and board→drag card to different column→status syncs→click into detail→tabs switch correctly |
| **Depends On** | T-16 |

#### T-18: Frontend Document Pages (F46,F47,F52)
| Field | Value |
|-------|-------|
| **ID** | T-18 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Document center layout (left folder tree + right file list), folder/file upload (drag-drop zone), document preview (image direct, others show info + download), share dialog (generate link with permission + access code settings, copy to clipboard) |
| **Files To Create** | `pages/document/DocumentCenterPage.tsx`, `DocumentPreviewPage.tsx`, `components/document/DocTreeNode.tsx`, `DocUploader.tsx`, `DocPreview.tsx`, `ShareDialog.tsx` |
| **Files To Modify** | `router/index.tsx` (add document routes) |
| **Steps** | 1. DocumentCenterPage — Ant Design Tree (left) + Table (right), click folder→browse, context menu; 2. DocTreeNode — folder icon, expand/collapse, right-click menu (new folder, upload); 3. DocUploader — drag-drop zone + click to upload, type/size validation display; 4. DocumentPreviewPage — preview area (image: direct display, PDF: embed viewer, Office: info + download, other: download link); 5. DocPreview — component with format detection; 6. ShareDialog — modal with permission select (view/edit/comment), access code toggle, copy link button |
| **Verification** | Create folder→upload document→tree updates→click file→preview page→share dialog→generate and copy link |
| **Depends On** | T-16 |

#### T-19: Frontend Approval Pages (F53,F57)
| Field | Value |
|-------|-------|
| **ID** | T-19 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Approval list (status filter tabs, creator/time search), approval detail (form data display, approval progress timeline with Ant Design Timeline, current node/processor info), approval initiation form (select template + fill fields) |
| **Files To Create** | `pages/approval/ApprovalListPage.tsx`, `ApprovalDetailPage.tsx`, `components/approval/ApprovalTimeline.tsx`, `ApprovalForm.tsx` |
| **Files To Modify** | `router/index.tsx` (add approval routes) |
| **Steps** | 1. ApprovalListPage — filterable table (status: pending/approved/rejected/canceled, creator, time range); 2. ApprovalForm — select template (dropdown with descriptions), render dynamic form fields from template config, submit to create; 3. ApprovalDetailPage — form data display, ApprovalTimeline, current node + processor info; 4. ApprovalTimeline — Ant Design Timeline showing each node with status, processor, time; |
| **Verification** | Initiate approval→listed→click detail→view timeline with current node and processor |
| **Depends On** | T-16 |

#### T-20: Frontend Comment & Notification Pages (F41-F43,F67-F69)
| Field | Value |
|-------|-------|
| **ID** | T-20 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Comment components (CommentList with avatar/name/time/content/attachments, CommentInput with rich text toolbar / @mention popover / file upload button), notification center page (unread/read tabs, type filter, click-to-navigate), notification bell in Header (unread count badge, dropdown preview of recent items) |
| **Files To Create** | `components/comment/CommentList.tsx`, `CommentInput.tsx`, `pages/notification/NotificationCenterPage.tsx`, `components/notification/NotificationBell.tsx` |
| **Files To Modify** | `TaskDetailPage.tsx` (integrate CommentList + CommentInput in a tab), `Header.tsx` (integrate NotificationBell), `router/index.tsx` (add /notifications route) |
| **Steps** | 1. CommentList — display comments in reverse chronological order, avatar, display name, timestamp, content, attachment list; 2. CommentInput — textarea with toolbar (bold/italic, @mention member selector popover, file attach button); 3. Integrate into TaskDetailPage as Comments tab; 4. NotificationCenterPage — Ant Design Tabs (unread/all), type filter chips, list items with color-coded type icon, click→navigate; 5. NotificationBell — Header icon with badge, dropdown popover showing last 5 unread, "View All" link; |
| **Verification** | Post comment in task detail→appears in list→@mention triggers notification→bell shows unread→click into center→mark read→click navigates to resource |
| **Depends On** | T-17 |

#### T-21: Frontend User Stats Page (F82)
| Field | Value |
|-------|-------|
| **ID** | T-21 |
| **Owner** | `frontend` |
| **Phase** | Prototype |
| **Goal** | Personal profile page (view/edit display name, avatar), personal statistics page (stat cards: total tasks, completion rate, pending, overdue) |
| **Files To Create** | `pages/user/UserStatsPage.tsx`, `ProfilePage.tsx` |
| **Files To Modify** | `router/index.tsx` (add /user/profile, /user/stats) |
| **Steps** | 1. ProfilePage — display+edit form for display name, avatar URL; 2. UserStatsPage — Ant Design Statistic cards row (total tasks, completion %, pending, overdue), simple chart (optional); |
| **Verification** | Visit stats page→displays correct task statistics; profile edits save and persist |
| **Depends On** | T-15 |

### Phase 2 — V1 Production-ready — Backend

#### T-22: Backend RBAC Module (F23-F27)
| Field | Value |
|-------|-------|
| **ID** | T-22 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Complete RBAC system: role definitions (owner/admin/leader/member/reader/guest), permission matrix with operation→resource mapping, resource-level permission override (doc_shares table), approval template scope constraints |
| **Files To Create** | `modules/rbac/rbac.module.ts`, `rbac.service.ts`, `rbac.controller.ts`, `dto/assign-role.dto.ts` |
| **Files To Modify** | `common/guards/rbac.guard.ts` (full implementation with `@Rbac()` decorator parsing) |
| **Steps** | 1. RbacService — role hierarchy and permission matrix data; 2. RbacService.checkPermission() — user + resource type + operation → boolean; 3. RbacService.getUserRoles() — resolve user's enterprise and team roles; 4. Resource-level permission query (check doc_shares table); 5. Role hierarchy comparison utility; 6. Full RbacGuard implementation — read required permission from @Rbac() decorator, verify current user meets requirement; 7. Permission matrix seed data; 8. Approval template scope boundary validation |
| **Verification** | Different roles accessing same endpoint→200 or 403 correctly; resource-level permission overrides role default; template creation respects admin boundary |
| **Depends On** | T-05 |
| **Requirements Ref** | REQUIREMENTS.md §3.5 (F23-F27) |
| **Architecture Ref** | ARCHITECTURE.md §授权架构 (RBAC), §权限矩阵 |

#### T-23: Backend Auth Enhancement (F05,F07)
| Field | Value |
|-------|-------|
| **ID** | T-23 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Forgot password flow (email verification → reset token → new password), login failure counting with Redis, temporary account lockout (5 failures → 15 min lock) |
| **Files To Create** | `dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts` |
| **Files To Modify** | `auth.service.ts`, `auth.controller.ts` |
| **Steps** | 1. AuthService.forgotPassword() — validate email, generate reset token (store in Redis with TTL), send reset link (simulated); 2. AuthService.resetPassword() — verify reset token, update password hash; 3. Login rate limiting — increment Redis counter on failure, lock when threshold reached, auto-unlock after TTL; 4. Add controller endpoints: POST /auth/forgot-password, POST /auth/reset-password |
| **Verification** | 5 consecutive wrong passwords→account locked→15 min later auto-unlock; forgot password→reset→new password works for login |
| **Depends On** | T-22 |
| **Requirements Ref** | REQUIREMENTS.md §3.1 (F05,F07) |

#### T-24: Backend Tenant & Team Enhancement (F09,F11,F15-F17,F20,F21)
| Field | Value |
|-------|-------|
| **ID** | T-24 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Auto-create tenant schema on enterprise creation (CREATE SCHEMA t_<id> + run migrations), enterprise info edit (name, logo), team archive (readonly after archive), team visibility (public/private), member join request with approval, batch invite (email list), member leave/remove with permission checks |
| **Files To Create** | `modules/tenant/tenant.provision.service.ts`, `dto/batch-invite.dto.ts`, `dto/join-request.dto.ts` |
| **Files To Modify** | `tenant.service.ts`, `team.service.ts`, `common/middleware/tenant.middleware.ts` (actual search_path switching via PrismaTenantService/CLS) |
| **Steps** | 1. TenantProvisionService — on enterprise create: execute CREATE SCHEMA, run Prisma migrations on new schema; 2. Enterprise info edit endpoint; 3. Team archive (is_archived=true, editable=false) + visibility toggle; 4. Join request flow (create request → notify leader → approve/reject); 5. Batch invite (email list → create invitations + notifications); 6. Member leave/remove logic; 7. Complete TenantMiddleware with CLS-based Prisma schema switching |
| **Verification** | Create enterprise→auto creates schema in DB; edit enterprise info→saves; archive team→readonly; private team→non-members get 403; join request→approve→joined; batch invite→all invited; member leaves→permissions revoked |
| **Depends On** | T-22 |

#### T-25: Backend Task Enhancement (F32,F33,F35)
| Field | Value |
|-------|-------|
| **ID** | T-25 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Subtasks (via parent_task_id, recursive query), task relations (link to documents/resources/tasks via task_relations table), batch operations (atomic status/assignee/priority change on multiple tasks) |
| **Files To Create** | `dto/batch-task.dto.ts`, `dto/task-relation.dto.ts` |
| **Files To Modify** | `task.service.ts`, `task.controller.ts` |
| **Steps** | 1. Subtask support — parent_task_id field, recursive query to get subtask tree; 2. TaskService.addRelation() — link task to doc/resource/task (write to task_relations); 3. TaskService.getRelations() — get related resources list; 4. TaskService.batchUpdate() — atomic batch status/assignee/priority change (Prisma transaction); 5. TaskService.batchDelete() — batch soft-delete; 6. New endpoints: POST /api/v1/tasks/batch, GET /api/v1/tasks/:id/relations, POST /api/v1/tasks/:id/relations |
| **Verification** | Create parent task→add subtask→subtask tree correct; link document to task→relation visible; batch update multiple tasks→all change atomically |
| **Depends On** | T-24 |

#### T-26: Backend Board Enhancement (F38-F40)
| Field | Value |
|-------|-------|
| **ID** | T-26 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Gantt chart data (tasks with start/due dates + dependencies), calendar view data (tasks grouped by due date: month/week/day), custom board column config (add/delete/reorder, rename, color, swimlane support) |
| **Files To Modify** | `board.service.ts`, `board.controller.ts` |
| **Steps** | 1. BoardService.getGanttData() — return task list with dates, dependencies (from task_relations), format suitable for frontend chart library; 2. BoardService.getCalendarData() — group tasks by due date (month/week/day granularity); 3. BoardService.updateColumnConfig() enhanced — custom name, color, sort_order, add/delete columns, status mapping; 4. Swimlane support — group by assignee or custom field; 5. New endpoints: GET /api/v1/teams/:id/board/gantt, GET /api/v1/teams/:id/board/calendar |
| **Verification** | Gantt API returns tasks with dependency timeline; calendar API returns tasks grouped by date; board columns customizable |
| **Depends On** | T-25 |

#### T-27: Backend Comment Enhancement (F44,F45)
| Field | Value |
|-------|-------|
| **ID** | T-27 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Comment replies (parent_id support, nested or flat-with-indent return), comment edit (update content, is_edited=true flag), comment delete (soft/hard, owner or admin only), attachment preview (image thumbnails, Office preview signed URLs) |
| **Files To Modify** | `comment.service.ts`, `comment.controller.ts`, `storage.service.ts` |
| **Steps** | 1. Comment reply — parent_id field, return tree or flat indented list; 2. CommentService.update() — edit content, set is_edited=true; 3. CommentService.delete() — soft delete, owner or admin only; 4. Attachment preview — image thumbnail generation, Office document preview signed URL generation; 5. New endpoints: PATCH /api/v1/comments/:id, DELETE /api/v1/comments/:id |
| **Verification** | Reply to comment→nested display; edit comment→"edited" label appears; delete comment→disappears; image attachment→preview thumbnail |
| **Depends On** | T-25 |

#### T-28: Backend Document Enhancement (F48,F49,F51)
| Field | Value |
|-------|-------|
| **ID** | T-28 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Online document preview (Office via third-party viewer, PDF/images directly), lightweight rich-text editor backend (save HTML/Markdown content), full-text search (PostgreSQL to_tsvector / ts_query, ranked by relevance) |
| **Files To Create** | `modules/document/document-search.service.ts`, `dto/search-document.dto.ts` |
| **Files To Modify** | `document.service.ts`, `document.controller.ts` |
| **Steps** | 1. Document preview — Office docs (via viewer library or conversion), PDF (embed), images (direct); 2. Rich-text editor backend — add content field to documents table, save/retrieve HTML/Markdown; 3. DocumentSearchService — PostgreSQL FTS (to_tsvector on name + content, ts_query ranking); 4. Search API: GET /api/v1/documents/search?q=; 5. Document move/rename functionality |
| **Verification** | Upload Office doc→preview (or graceful download fallback); rich-text edit→save→reopen→content intact; full-text search returns relevant results ranked by match |
| **Depends On** | T-27 |

#### T-29: Backend Approval Enhancement (F54-F56)
| Field | Value |
|-------|-------|
| **ID** | T-29 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Step-by-step approval engine: submit→node1→process→node2→...→final (single: any approver, countersign: all approvers, any-sign: any approver). Actions: approve (advance), reject (terminate), return (send back to previous node or initiator), redirect (transfer to another approver). Custom approval templates with custom form fields (JSONB), multiple nodes, configurable approvers |
| **Files To Create** | `modules/approval/approval-engine.service.ts`, `approval-template.service.ts`, `dto/create-template.dto.ts`, `dto/approval-action.dto.ts` |
| **Files To Modify** | `approval.service.ts`, `approval.controller.ts` |
| **Steps** | 1. ApprovalEngineService — core flow: submit→check current node→process action→advance to next or complete→final status; 2. Three approval modes: single (any), all (countersign), any (or-sign); 3. Action implementations: approve→node complete, reject→status=rejected, return→move to previous node/initiator, redirect→change approver; 4. ApprovalTemplateService — template CRUD, node configuration, form_fields definition (JSONB); 5. Auto-progression — when last action on node completes, auto-advance to next node; 6. New endpoints: GET/POST /api/v1/approval-templates, POST /api/v1/approvals/:id/actions |
| **Verification** | Create multi-node template→initiate→first node→approve→advance to second→all approve→status=approved; reject→status=rejected; countersign requires all approvers |
| **Depends On** | T-28 |

#### T-30: Backend Resource Module (F63-F65)
| Field | Value |
|-------|-------|
| **ID** | T-30 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | External repo integration (Git repo URL/config, S3 bucket config), directory browsing (list files/folders by path), resource mounting (link repo items to tasks/documents via resource_links table) |
| **Files To Create** | `modules/resource/resource.module.ts`, `resource.controller.ts`, `resource.service.ts`, `dto/create-repo.dto.ts`, `dto/link-resource.dto.ts` |
| **Files To Modify** | `app.module.ts` (register ResourceModule) |
| **Steps** | 1. ResourceService.createRepo() — save repo config (type: git/s3, connection params in JSONB); 2. ResourceService.browseRepo() — list items by path (Git: read tree via CLI or data file; S3: SDK listObjects); 3. ResourceService.createLink() — create resource_links record linking repo item to task/document; 4. Resource query endpoints; 5. All API endpoints |
| **Verification** | Add repo→browse folders→select file→mount to task→task detail shows linked resource |
| **Depends On** | T-29 |

#### T-31: Backend Milestone Module (F72-F74)
| Field | Value |
|-------|-------|
| **ID** | T-31 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Milestone CRUD (name, description, due_date, status), auto-progress calculation (completed tasks / total linked tasks × 100%), milestone kanban view grouped by status (active/completed/overdue) |
| **Files To Create** | `modules/milestone/milestone.module.ts`, `milestone.controller.ts`, `milestone.service.ts`, `dto/create-milestone.dto.ts` |
| **Files To Modify** | `app.module.ts` (register MilestoneModule) |
| **Steps** | 1. MilestoneService.create() / update() / delete() / findAll(); 2. MilestoneService.addTask() / removeTask() — link/unlink tasks; 3. Progress auto-calculation — query task completion ratio; 4. Milestone kanban data — group by status (active, completed, overdue); 5. All API endpoints |
| **Verification** | Create milestone→link tasks→complete some tasks→progress % auto-updates→kanban groups correctly |
| **Depends On** | T-30 |

#### T-32: Backend Message Module (F76,F77)
| Field | Value |
|-------|-------|
| **ID** | T-32 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Team instant messaging via Socket.IO WebSocket (join room by teamId, send/receive real-time messages), message history with cursor-based pagination, message text search |
| **Files To Create** | `modules/message/message.module.ts`, `message.controller.ts`, `message.service.ts`, `message.gateway.ts`, `dto/send-message.dto.ts` |
| **Files To Modify** | `app.module.ts` (register MessageModule) |
| **Steps** | 1. MessageGateway — Socket.IO gateway, handle `join_room` (by teamId) and `send_message` events; 2. MessageService.sendMessage() — persist to DB + broadcast to room; 3. MessageService.getHistory() — cursor-based pagination; 4. MessageService.searchMessages() — text search in message content; 5. Redis Adapter config for socket.io (horizontal scaling support); 6. REST endpoint: GET /api/v1/teams/:id/messages, WebSocket: WS /ws/chat/:teamId |
| **Verification** | Two browsers logged in→join same team chat→send message→both receive in real-time→scroll loads older→search returns matched messages |
| **Depends On** | T-31 |

#### T-33: Backend Dashboard Module (F80-F82)
| Field | Value |
|-------|-------|
| **ID** | T-33 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Enterprise overview (total tasks, completion rate, active members, document count, team count), team-level task statistics (distribution, completion comparison, trends by day/week/month), personal stats enhancement (completion trend, status breakdown, overdue rate) |
| **Files To Modify** | `dashboard.service.ts`, `dashboard.controller.ts` |
| **Steps** | 1. Enterprise overview — aggregate across all teams within tenant; 2. Team-level stats — per-team task distribution, completion rates, trend data; 3. Personal stats enhancement — trend line data, breakdown pie data; 4. Chart-friendly data format output; 5. New endpoints: GET /api/v1/dashboard/enterprise, GET /api/v1/dashboard/team/:teamId |
| **Verification** | Enterprise dashboard returns correct aggregated data; team stats include trend data; personal stats show breakdown |
| **Depends On** | T-32 |

#### T-34: Backend Graph Module (F59-F61)
| Field | Value |
|-------|-------|
| **ID** | T-34 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Collaboration resource graph: relationship query from graph_edges + real-time joins, React Flow-compatible node/edge data format, type-based filtering, auto-write graph_edges on relation creation (task-relation, document-link, comment, membership etc.) |
| **Files To Create** | `modules/graph/graph.module.ts`, `graph.controller.ts`, `graph.service.ts` |
| **Files To Modify** | `app.module.ts` (register GraphModule) |
| **Steps** | 1. GraphService.getGraph() — query relationships (graph_edges + real-time aggregation) for given resource; 2. GraphService.buildNodeData() — format for React Flow (id, type, position, data); 3. GraphService.buildEdgeData() — format edges (source, target, label, type); 4. Auto-write hooks — create graph_edges when task-relation, doc-share, comment, team-member relationships are created; 5. Type filtering — show only task/doc/member/resource relations; 6. API endpoint: GET /api/v1/graph/:resourceType/:resourceId |
| **Verification** | Task A linked to Doc B→query task A's graph→returns nodes {A,B} and edges {A→B}; filter type→only shows selected relation types |
| **Depends On** | T-33 |
| **Architecture Ref** | ARCHITECTURE.md §协作资源图谱架构 |

#### T-35: Backend Audit Module (F85,F86)
| Field | Value |
|-------|-------|
| **ID** | T-35 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Append-only audit log (no UPDATE/DELETE), query with filters (time range, action type, user, resource type), CSV/JSON export |
| **Files To Create** | `modules/audit/audit.module.ts`, `audit.controller.ts`, `audit.service.ts` |
| **Files To Modify** | `common/interceptors/audit-log.interceptor.ts` (full implementation), `app.module.ts` (register AuditModule) |
| **Steps** | 1. AuditService.log() — write record (user_id, action, resource_type, resource_id, detail JSONB, ip_address, user_agent); 2. AuditService.findAll() — filtered paginated query; 3. AuditService.export() — CSV/JSON export; 4. AuditLogInterceptor — @AuditLog() decorator drives automatic interceptor-based logging; 5. Key operation instrumentation (login/logout, resource CRUD, role changes, permission changes, tenant settings); 6. API endpoints: GET /api/v1/audit-logs, POST /api/v1/audit-logs/export |
| **Verification** | Create task→audit log auto-appended→query list shows operation→export CSV contains data |
| **Depends On** | T-34 |

#### T-36: Backend Security & Isolation (F84,F87)
| Field | Value |
|-------|-------|
| **ID** | T-36 |
| **Owner** | `backend` |
| **Phase** | V1 |
| **Goal** | Full tenant data isolation via PrismaTenantService with AsyncLocalStorage (dynamic search_path = t_<tenant_id>, public), security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS), CSRF protection (SameSite=Strict + Double Submit Cookie), global rate limiting (@nestjs/throttler + Redis store), user input XSS/SQL injection prevention (React default + Class-Validator) |
| **Files To Create** | `common/middleware/security.middleware.ts` |
| **Files To Modify** | `common/middleware/tenant.middleware.ts` (complete schema switching via PrismaTenantService), `src/prisma/prisma-tenant.service.ts` (CLS-based implementation), `main.ts` (register new middleware + rate limiter) |
| **Steps** | 1. Complete TenantMiddleware — parse X-Tenant-Id, resolve tenant, set search_path via PrismaTenantService (CLS/AsyncLocalStorage); 2. PrismaTenantService — per-request schema isolation using AsyncLocalStorage; 3. Cross-tenant access test (X-Tenant-Id:A → can't see tenant B data); 4. SecurityMiddleware — set CSP, X-Frame-Options, X-Content-Type-Options, HSTS headers; 5. CSRF protection — SameSite Cookie + CSRF token validation on state-changing requests; 6. XSS prevention — verify React + Ant Design default output encoding; 7. Input validation — all endpoints use class-validator DTOs; 8. Global rate limiting — @nestjs/throttler with Redis store (default: 100 req/min per user) |
| **Verification** | Tenant A's token + X-Tenant-Id:A can only query A's data; tenant B's data returns 404/403; security headers present in response; rate limit exceeded returns 429 |
| **Depends On** | T-35 |
| **Requirements Ref** | REQUIREMENTS.md §3.17 (F84,F87) |
| **Architecture Ref** | ARCHITECTURE.md §安全防护措施, §多租户架构设计, §Schema 级隔离实现细节 |

### Phase 2 — V1 Production-ready — Frontend

#### T-37: Frontend RBAC Integration
| Field | Value |
|-------|-------|
| **ID** | T-37 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Integrate RBAC into frontend: usePermission hook with can(operation, resourceType), Permission component for declarative conditional rendering, route-level permission guard, sidebar nav item visibility by role, action button visibility (edit/delete/create) |
| **Files To Modify** | `hooks/usePermission.ts` (full implementation), `router/guards.tsx` (add PermissionGuard), all page components with RBAC-sensitive UI |
| **Steps** | 1. Complete usePermission hook — can(operation, resourceType) method, checks user roles (from authStore) against permission matrix; 2. Permission Guard — route-level permission check, redirect or 403 page; 3. Permission component — `<Permission op="task:create"><Button>Create</Button></Permission>` pattern; 4. Sidebar nav visibility — hide admin-only items from member/reader; 5. Action buttons — Reader sees view-only, Member sees own-task edit, Leader sees team management; 6. Resource-level permission — doc share link permissions checked before allowing edit |
| **Verification** | Different roles logged in see different UI; Reader sees no edit/delete buttons; Member can only edit own tasks; Owner sees all admin controls |
| **Depends On** | T-21, T-22 |

#### T-38: Frontend Auth Enhancement Pages (F05,F07)
| Field | Value |
|-------|-------|
| **ID** | T-38 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Reset password page (email → verification code → new password), login page enhancement (show remaining attempts count, locked account message with countdown) |
| **Files To Create** | `pages/auth/ResetPasswordPage.tsx` |
| **Files To Modify** | `LoginPage.tsx` (failure/lockout feedback), `router/index.tsx` (add /auth/reset-password route) |
| **Steps** | 1. ResetPasswordPage — step form: step1 email input, step2 verification code, step3 new password + confirm; 2. LoginPage enhancement — on failed login, show "X attempts remaining" warning; on lock, show "Account locked. Try again in 15 minutes" with countdown timer; |
| **Verification** | 5 failed logins→"Account locked for 15 min" message appears; forgot password→reset flow succeeds→new password works |
| **Depends On** | T-37, T-23 |

#### T-39: Frontend Tenant & Team Enhancement Pages
| Field | Value |
|-------|-------|
| **ID** | T-39 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Enterprise settings page (edit name, logo upload), team archive/unarchive button + archived status display, team visibility toggle (public/private), batch invite members (email list textarea), member leave button, member join request approval panel |
| **Files To Create** | `pages/tenant/TenantSettingsPage.tsx` |
| **Files To Modify** | `TeamSettings.tsx` (add archive + visibility controls), `TeamMembers.tsx` (add batch invite, leave button, requests approval), `router/index.tsx` (add /org/:orgId/settings) |
| **Steps** | 1. TenantSettingsPage — form with name, industry, scale, logo upload; 2. TeamSettings — archive toggle (confirm dialog), visibility switch; 3. TeamMembers — batch invite modal (textarea for emails), leave team button (with confirm); 4. Join request panel — tab showing pending requests with approve/reject buttons; |
| **Verification** | Enterprise info edit→saves; team archive→UI shows readonly; visibility toggle→private team hides from non-members; batch invite→notifications sent; leave→removed from list |
| **Depends On** | T-37, T-24 |

#### T-40: Frontend Task Enhancement Pages (F32,F33,F35)
| Field | Value |
|-------|-------|
| **ID** | T-40 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Subtask UI (collapsible list, check to complete, add subtask, progress indicator), task relation picker (search and select documents/tasks/resources), batch action toolbar (appears on multi-select, supports status/assignee/priority change and delete) |
| **Files To Create** | `components/task/SubTaskList.tsx`, `TaskRelationPicker.tsx`, `BatchActionBar.tsx` |
| **Files To Modify** | `TaskDetailPage.tsx` (integrate subtasks + relations tabs), `TaskListPage.tsx` (add checkbox selection + BatchActionBar) |
| **Steps** | 1. SubTaskList — expandable list, checkbox to mark complete, "Add subtask" inline form, progress bar; 2. TaskRelationPicker — modal with search tabs (documents, tasks, resources), select multi & confirm; 3. BatchActionBar — floating bar appearing when >0 items selected, dropdowns for batch status/assignee/priority change, batch delete button with confirm; 4. Integrate into TaskDetailPage (subtasks tab + relations tab); 5. Integrate into TaskListPage (checkbox column + BatchActionBar) |
| **Verification** | Task detail shows subtasks→completing subtask updates progress; relation picker lets you link existing resources→links visible; task list multi-select→batch action changes all at once |
| **Depends On** | T-39, T-25 |

#### T-41: Frontend Board Enhancement Views (F38-F40)
| Field | Value |
|-------|-------|
| **ID** | T-41 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Gantt chart view (ECharts/AntV G2 showing task bars, time axis, dependency arrows), calendar view (Ant Design Calendar with task count markers, click date→show task list popover), board column config dialog (drag to reorder, rename, add/delete columns, color picker, status mapping) |
| **Files To Create** | `pages/task/GanttPage.tsx`, `CalendarPage.tsx`, `components/task/BoardColumnConfig.tsx` |
| **Files To Modify** | `router/index.tsx` (add /gantt, /calendar routes), `BoardPage.tsx` (add column config button) |
| **Steps** | 1. GanttPage — ECharts bar chart, x-axis = timeline, y-axis = task list, bars from start to due date, arrows for dependencies; 2. CalendarPage — Ant Design Calendar with dot markers on dates with tasks, click date→popover lists tasks; 3. BoardColumnConfig — modal with sortable list of columns (dnd-kit), editable name, color input, add/delete buttons, status dropdown mapping; |
| **Verification** | Gantt shows tasks as timeline bars with dependency arrows; calendar marks dates with tasks; board columns can be customized (add, rename, reorder, delete) |
| **Depends On** | T-39, T-26 |

#### T-42: Frontend Document Enhancement Pages (F48,F49,F51)
| Field | Value |
|-------|-------|
| **ID** | T-42 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Online document preview (Office: embed viewer or fallback, PDF: react-pdf or native embed, images: direct display), rich-text inline editor (TipTap or React-Quill with save button), document search bar with highlighted results |
| **Files To Create** | `pages/document/DocumentEditorPage.tsx` |
| **Files To Modify** | `DocumentPreviewPage.tsx` (enhanced preview), `DocumentCenterPage.tsx` (add search bar), `router/index.tsx` (add /docs/:docId/edit route) |
| **Steps** | 1. Enhanced preview — Office docs (embed iframe or @microsoft/office-viewer), PDF (react-pdf or native <embed>), images direct display; 2. DocumentEditorPage — rich-text editor (TipTap/react-quill), save button calls API to persist content; 3. DocumentCenterPage — add SearchInput at top, call search API on input, display filtered results with keyword highlighting; |
| **Verification** | Upload Office doc→preview shows content (or graceful download fallback); rich-text editor→save→reopen→content intact; search→matched documents listed with highlighted keywords |
| **Depends On** | T-39, T-28 |

#### T-43: Frontend Approval Enhancement Pages (F54-F56)
| Field | Value |
|-------|-------|
| **ID** | T-43 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Approval action UI (approve/reject/return/redirect buttons, visible only to current node approver), approval progress timeline (show each node with status, processor, processing time), approval template builder (create/edit templates: name, description, scope, nodes configuration with approver type + approver selection) |
| **Files To Create** | `pages/approval/ApprovalTemplatePage.tsx`, `components/approval/TemplateBuilder.tsx` |
| **Files To Modify** | `ApprovalDetailPage.tsx` (add action buttons + enhanced timeline), `router/index.tsx` (add /approvals/templates route) |
| **Steps** | 1. ApprovalDetailPage enhancement — action buttons appear only for current node approver, each button triggers confirmation dialog; timeline enhanced with node status icons, processor avatars, timestamps; 2. ApprovalTemplatePage — template list with create/edit/delete; 3. TemplateBuilder — step-by-step: step1 name/description/scope, step2 add nodes with sort order, step3 configure each node (approver type: single/all/any, approver multi-select), step4 review & save; |
| **Verification** | Approval detail shows action buttons only for current approver→approve→node advances to next; template builder creates multi-node template→saved→usable in new approvals |
| **Depends On** | T-39, T-29 |

#### T-44: Frontend Graph Pages (F59-F61)
| Field | Value |
|-------|-------|
| **ID** | T-44 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Resource graph visualization (React Flow): custom node types (task/doc/member/resource with distinct icons/colors), directed edges with relation labels, type filter checkboxes (task/doc/member/resource), click node→navigate to detail, auto-layout (dagre algorithm), zoom/pan controls |
| **Files To Create** | `pages/graph/ResourceGraphPage.tsx`, `components/graph/ResourceGraph.tsx`, `GraphNode.tsx` |
| **Files To Modify** | `router/index.tsx` (add /graph route) |
| **Steps** | 1. ResourceGraph — React Flow wrapper with dagre auto-layout, custom nodeTypes, background grid, minimap, controls; 2. GraphNode — custom node renderers: TaskNode (blue, task icon), DocNode (green, file icon), MemberNode (orange, user icon), ResourceNode (purple, database icon); 3. ResourceGraphPage — resource selector dropdown (select which task/doc to view graph), graph canvas, filter toolbar (checkboxes for node types), click handler → router.push to detail page; |
| **Verification** | Select a task→graph renders connected nodes and edges→toggle type filter→graph updates→click node→navigate to detail |
| **Depends On** | T-39, T-34 |

#### T-45: Frontend Milestone Pages (F72-F74)
| Field | Value |
|-------|-------|
| **ID** | T-45 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Milestone kanban view grouped by status (active/completed/overdue columns), milestone card with progress bar, name, due date, linked task count; create/edit milestone modal (name, description, due_date, task multi-selector) |
| **Files To Create** | `pages/milestone/MilestonePage.tsx`, `components/milestone/MilestoneCard.tsx` |
| **Files To Modify** | `router/index.tsx` (add /milestones route) |
| **Steps** | 1. MilestonePage — three-column kanban (active, completed, overdue), each column contains MilestoneCards; 2. MilestoneCard — card with name, progress bar (Ant Design Progress), due date, task count, status tag; 3. Create/edit modal — name, description, due_date inputs, task selector (search and multi-select from team tasks); |
| **Verification** | Create milestone→appears in active column→link tasks→progress updates→complete all tasks→moves to completed column |
| **Depends On** | T-39, T-31 |

#### T-46: Frontend Chat Pages (F76,F77)
| Field | Value |
|-------|-------|
| **ID** | T-46 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Team chat page (socket.io-client connection to /ws/chat/:teamId, message list with sender avatar/name/time, text input with send button), infinite scroll for history (IntersectionObserver at top), message search (search box → API call → results display with highlighted matches) |
| **Files To Create** | `pages/message/TeamChatPage.tsx` |
| **Files To Modify** | `router/index.tsx` (add /messages route) |
| **Steps** | 1. Establish WebSocket connection (socket.io-client), handle `connect`/`disconnect` status; 2. Join room on teamId, listen for `new_message` events; 3. Message list — display messages with sender avatar, name, timestamp, content, grouped by date; 4. Input area — text input + send button, emit send_message event; 5. Infinite scroll — load older messages on scroll-to-top via IntersectionObserver; 6. Search — search input, call REST API, display results with highlighting; |
| **Verification** | Two browsers open same chat→send message→both receive in real-time→scroll up loads history→search returns matched messages with highlights |
| **Depends On** | T-39, T-32 |

#### T-47: Frontend Dashboard Pages (F80-F82)
| Field | Value |
|-------|-------|
| **ID** | T-47 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Enterprise dashboard page (stat cards row: total tasks, completion rate, active members, document count; charts: team distribution bar chart, task trend line chart), team dashboard (per-team stats with trend), personal dashboard (personal completion trend, status distribution pie) |
| **Files To Create** | `pages/dashboard/DashboardPage.tsx`, `components/dashboard/StatCard.tsx`, `TeamChart.tsx`, `UserChart.tsx` |
| **Files To Modify** | `router/index.tsx` (dashboard route at /org/:orgId and /org/:orgId/team/:teamId) |
| **Steps** | 1. DashboardPage — Ant Design Row/Col layout with StatCards at top, TeamChart/UserChart below; 2. StatCard — icon, label, value, trend indicator (up/down arrow), colored background; 3. TeamChart — ECharts bar chart showing task distribution across teams, or pie chart for completion status breakdown; 4. UserChart — ECharts line chart showing task completion trend over time; |
| **Verification** | Dashboard shows correct aggregated stats; charts render with real data; charts are interactive (hover tooltips) |
| **Depends On** | T-39, T-33 |

#### T-48: Frontend Audit Log Pages (F85,F86)
| Field | Value |
|-------|-------|
| **ID** | T-48 |
| **Owner** | `frontend` |
| **Phase** | V1 |
| **Goal** | Audit log query page (Ant Design Table with columns: timestamp, operator, action type, resource type, detail), filter toolbar (date range picker, action type dropdown, operator search), CSV export button that triggers download |
| **Files To Create** | `pages/audit/AuditLogPage.tsx` |
| **Files To Modify** | `router/index.tsx` (add /org/:orgId/audit route) |
| **Steps** | 1. AuditLogPage — Table with columns (timestamp, operator avatar+name, action tag, resource type tag, detail expandable row); 2. Filter toolbar — RangePicker for date, Select for action type (create_task, delete_document, update_role etc.), Input.Search for operator; 3. Export button — calls POST /api/v1/audit-logs/export, handles file download; |
| **Verification** | Audit log table lists operations with correct data; filters narrow results correctly; export button downloads CSV file |
| **Depends On** | T-39, T-35 |

### Phase 3 — V2 Enhancement

#### T-49: Backend LLM Module (F88-F91)
| Field | Value |
|-------|-------|
| **ID** | T-49 |
| **Owner** | `backend` |
| **Phase** | V2 |
| **Goal** | LLM API integration (OpenAI-compatible, model router for multi-vendor), MCP protocol (Tool Registry with permission-scoped tools, Context Builder for tenant-aware context), Skill system (Summary, WeeklyReport, TaskSuggestion), model call permission control via RbacGuard |
| **Files To Create** | `modules/llm/llm.module.ts`, `llm.controller.ts`, `llm.service.ts`, `mcp/mcp.protocol.ts`, `mcp.tool-registry.ts`, `mcp.context-builder.ts`, `skills/skill.registry.ts`, `summary.skill.ts`, `weekly-report.skill.ts`, `task-suggestion.skill.ts`, `config/llm.config.ts` |
| **Files To Modify** | `app.module.ts` (register LLMModule) |
| **Steps** | 1. LlmService — OpenAI API wrapper (compatible interface), timeout, retry, circuit breaker; 2. ModelRouter — config-driven multi-provider switching; 3. MCPContextBuilder — build context from current tenant/user/team data; 4. MCPToolRegistry — register/lookup/execute tools, each with requiredPermission field; 5. SkillRegistry — combine multiple MCP tools into automated tasks; 6. Skills: SummarySkill (task summary), WeeklyReportSkill (generate report), TaskSuggestionSkill (task suggestions); 7. Permission control — check tool's requiredPermission via RbacGuard before execution; 8. API endpoints: POST /llm/chat, POST /llm/skills/:skillId/execute, GET /llm/mcp/tools |
| **Verification** | Chat API returns AI response; Skill execution returns expected output; unauthorized skill call returns 403 |
| **Depends On** | T-36 |
| **Requirements Ref** | REQUIREMENTS.md §3.18 (F88-F91) |
| **Architecture Ref** | ARCHITECTURE.md §MCP 扩展架构, §MCP 工具示例 |

#### T-50: Backend V2 Enhancements
| Field | Value |
|-------|-------|
| **ID** | T-50 |
| **Owner** | `backend` |
| **Phase** | V2 |
| **Goal** | All V2 features: OAuth login (GitHub/Google via passport), enterprise freeze/unsubscribe & quota management, task templates, document version management (version CRUD, rollback), approval timeout reminder (Bull cron), graph export (image/JSON), repo change notification, milestone overdue warning (Bull cron), message enhancements (quick-create task, reference document, read status), dashboard export (CSV/Excel), email notification (Bull queue + nodemailer) |
| **Verification** | OAuth login works; document version history viewable and rollbackable; approval timeout triggers notification; milestone overdue generates warning; dashboard data exports as CSV |
| **Depends On** | T-49 |

#### T-51: Frontend V2 Enhancements
| Field | Value |
|-------|-------|
| **ID** | T-51 |
| **Owner** | `frontend` |
| **Phase** | V2 |
| **Goal** | LLM chat interface (sidebar panel or dedicated page with conversation history, Skill trigger buttons), OAuth login buttons (GitHub/Google on login page), document version history panel (version list, diff view placeholder, rollback button), dark mode toggle (uiStore theme switch, Ant Design ConfigProvider dark algorithm), message quick-task creation (`@task` trigger) and doc reference (`@doc` auto-complete), read-status indicators, graph export button (download image), dashboard export button (download CSV), global search enhancement (search tasks+docs+members) |
| **Verification** | LLM chat interactive; dark mode toggles correctly; document version list shows history and rollback works; message input supports @task/@doc auto-complete; read-status dots appear |
| **Depends On** | T-48, T-49, T-50 |

## Agent Ownership

| Scope | Owner | Skipped |
|-------|-------|---------|
| Monorepo + shared types | `fullstack` | T-01 |
| Backend (NestJS/Prisma/modules) | `backend` | T-02, T-04~T-12, T-22~T-36, T-49, T-50 |
| Frontend (React/Ant Design/pages) | `frontend` | T-03, T-13~T-21, T-37~T-48, T-51 |

## File Scope

See ARCHITECTURE.md §Project Structure for complete file listing. Approximately 210+ source files across:
- `packages/shared-types/src/` — 3 files (enums, interfaces, constants)
- `packages/frontend/src/` — ~90 files (pages: 25+, components: 30+, hooks: 8, stores: 3, services: 7, utils: 3, styles: 3, router: 3, layouts: 3)
- `packages/backend/src/` — ~120 files (modules: 18, common: 15+, config: 5, prisma: 3)

## Data & Migration Work

| Task | Migration | Batch |
|------|-----------|-------|
| T-04 | Initial Prisma migration, create all 25+ tables | B3 |
| T-24 | Runtime tenant schema creation (prisma db push on new schema) | B16 |
| T-28 | Add `content` TEXT field to documents table | B19 |
| T-49 | LLM config table (llm_configs) | B34 |

**Seed data**: Approval templates (leave, expense, general) in T-11; RBAC permission matrix in T-22

## Test & Verification Plan

| Scope | Test Type | Tool | Details |
|-------|-----------|------|---------|
| Per task | Unit tests | Jest/Vitest | Core service/component logic, ≥70% coverage |
| B3~B12 | API tests | Jest+Supertest | Each endpoint: request/response/error validation |
| B10~B14 | Component tests | Vitest+Testing Library | Key UI components rendering & interaction |
| After B14 | Prototype integration | Playwright | Full path: register→create org→create team→create task→kanban drag |
| After B33 | Security tests | OWASP ZAP + manual | Permission matrix, cross-tenant isolation, XSS, CSRF |
| After B36 | E2E tests | Playwright | Complete user scenarios across all phases |
| Continuous | Build verification | pnpm build | Frontend + backend build without errors |

**General acceptance criteria**: (1) Build passes no errors; (2) Unit test coverage ≥70%; (3) API conforms to `{code, message, data, meta}` format; (4) Frontend renders without console errors; (5) State persists after page refresh

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Prisma multi-schema (@@schema) not fully stable | Medium | High | Early POC validation; raw SQL fallback for schema operations |
| R2 | Approval engine design too complex | Medium | Medium | Strict linear flow only; state machine pattern; no BPMN branching |
| R3 | WebSocket + Redis Adapter config | Medium | Medium | Prototype Socket.IO early; 200 concurrent OK without cluster |
| R4 | Office document preview poor quality | Medium | Medium | Download fallback always; evaluate KKFileView/commercial option later |
| R5 | LLM API cost/latency unpredictable | High | Medium | Cache common requests; circuit breaker; hard token/request limits |
| R6 | Frontend bundle too large | Medium | Low | Ant Design tree-shaking built-in; React.lazy + Suspense for routes; dynamic imports for heavy libs (ECharts, React Flow) |

## Open Questions

| # | Question | Suggested Decision |
|---|----------|-------------------|
| Q1 | Document preview: build-in or third-party service? | Local: react-pdf (PDF) + download fallback (Office); KKFileView if budget allows |
| Q2 | LLM provider choice? | OpenAI-compatible interface + config-driven provider switching; default Alibaba Tongyi Qianwen (domestic, stable) |
| Q3 | Soft delete needed (deleted_at)? | Yes, add `deleted_at` TIMESTAMPTZ nullable to all resource tables; audit log records deletion |
| Q4 | Message roaming across devices? | V1: web-only, no roaming; V2: evaluate |
| Q5 | Scheduled cleanup for expired shares/inactive accounts? | V1: implement Bull cron job for daily cleanup of expired doc_shares and unactivated accounts |

## Suggested Next Step

**Start T-01 immediately (Batch B1)**: Initialize pnpm workspace monorepo + shared-types package. This is the foundation for all subsequent work with zero external service dependencies.

Then execute batches sequentially B1 → B2 → B3 → ... → B36. Within each batch, parallel tasks can be dispatched simultaneously to separate `backend` and `frontend` agents. Serial tasks execute in order within the same batch.

After each batch completes, run `test` agent for automated tests and `review` agent for code review before proceeding to the next batch. For high-risk batches (B15 RBAC, B27 Security/Isolation, B34 LLM), pause for manual security review.
