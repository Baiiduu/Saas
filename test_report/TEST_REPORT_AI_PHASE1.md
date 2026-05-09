# AI 子需求第一阶段测试报告

## 1. 测试目标

本轮测试属于第一阶段正确性测试，目标是验证当前 AI 子需求的基础可用性，重点覆盖：

- 前后端接口契约是否基本对齐
- AI 会话、Skill、确认流是否可正常打通
- 权限控制与租户/团队作用域是否正确
- AI 相关数据模型是否已真实落库并可支撑运行

本轮不包含：

- 压力测试
- 性能测试
- 安全渗透测试
- 视觉/UI 体验评审

---

## 2. 测试环境

| 项目 | 结果 |
|------|------|
| 时间 | 2026-05-08 |
| 后端地址 | `http://localhost:3000/api/v1` |
| 数据库 | PostgreSQL，本地 Docker |
| Redis | 本地 Docker |
| MinIO | 本地 Docker |
| 后端构建 | `pnpm --filter @saas/backend build` 通过 |
| 前端构建 | `pnpm --filter frontend build` 通过 |
| Prisma 迁移状态 | **存在未应用 AI 迁移** |

`prisma migrate status` 结果：

- 未应用迁移 `20260508083000_ai_services`
- 未应用迁移 `20260508113000_ai_memory_foundation`

---

## 3. 测试数据准备

本轮先注入了一组确定性测试数据。

### 3.1 基础上下文

| 项目 | 值 |
|------|----|
| 主租户 | `98178ecd-7a75-4eb8-ba8b-a444c395a010` |
| 主团队 | `2f2895e0-a781-4d45-b174-bf9fc8033ab1` |
| 隔离租户 | `11111111-1111-4111-8111-111111111111` |

### 3.2 测试账号

统一密码：`TestPass123!`

| 角色 | 邮箱 |
|------|------|
| Owner | `2917781292@qq.com` |
| Member | `ai.phase1.member@example.com` |
| Reader | `ai.phase1.reader@example.com` |
| Guest | `ai.phase1.guest@example.com` |
| Outsider | `ai.phase1.outsider@example.com` |

### 3.3 业务对象

| 类型 | 说明 |
|------|------|
| Task | 2 条，包含 1 条已指派给 Member 的任务 |
| Document | 1 条 Owner 创建的测试文档 |
| Approval Template | 1 条审批模板，含 `reason`、`days` 字段 |
| Milestone | 1 条测试里程碑 |

---

## 4. 执行概况

本轮共执行 `21` 个测试点：

- 通过：`6`
- 失败：`15`
- 高优先级失败：`4`

原始结果文件：

- `.tmp/ai-phase1-results.json`

---

## 5. 通过项

### 5.1 权限基础判断可用

已验证：

- 多角色登录成功
- `Member` 可见 AI tools
- `Owner` 可见全部首批 Skill
- `Reader` 被 `llm.read` 正确拒绝
- `Guest` 被 `llm.create` 正确拒绝

对应结果：

- `AI-P1-LOGIN-01`
- `AI-P1-TOOLS-01`
- `AI-P1-SKILL-01`
- `AI-P1-PERM-01`
- `AI-P1-PERM-02`

### 5.2 审批模板接口与前端表单契约基本对齐

已验证：

- `GET /approval-templates?teamId=...` 返回了目标审批模板
- `formFields.fields` 结构与前端 `ChatPage` 的 `normalizeTemplateFields()` 兼容

对应结果：

- `AI-P1-FE-BE-01`

---

## 6. 失败项与现象

### 6.1 AI 会话主链不可用

失败项：

- `AI-P1-SESSION-01`
- `AI-P1-CHAT-01`
- `AI-P1-SESSION-02`
- `AI-P1-PERM-03`
- `AI-P1-SESSION-03`

现象：

- 创建 AI 会话返回 `500`
- 发送消息返回 `500`
- 获取会话详情返回 `500`

直接错误：

- `tenant.ai_sessions` 表不存在

### 6.2 Skill 主链不可用

失败项：

- `AI-P1-SKILL-02`
- `AI-P1-CONFIRM-01`
- `AI-P1-CONFIRM-02`
- `AI-P1-CONFIRM-03`
- `AI-P1-CONFIRM-04`

现象：

- `doc-draft` 执行失败
- `approval-assist` 执行失败
- 确认流无法进入可验证状态

直接错误：

- `tenant.ai_skill_runs` 表不存在

### 6.3 记忆层不可用

失败项：

- `AI-P1-MEM-01`

现象：

- `AiMemory` 查询直接报错

直接错误：

- `tenant.ai_memories` 表不存在

### 6.4 审计链未形成可验收结果

失败项：

- `AI-P1-AUDIT-01`

现象：

- Owner / Member 会话未产出有效 AI 审计数据

说明：

- 该项主要是上游 AI 表缺失导致的级联失败

### 6.5 跨租户 teamId 权限边界存在漏洞

失败项：

- `AI-P1-PERM-04`
- `AI-P1-PERM-05`
- `AI-P1-PERM-06`

现象：

- `tenant2` 的 `Owner` 用户，传入 `tenant1` 的 `teamId` 后：
  - 可以成功获取 `tenant1` 团队的 AI Skill 列表
  - 可以成功获取 `tenant1` 团队的 MCP Tool 列表
  - 创建 AI Session 时没有先被 `403` 拒绝，而是继续走到落库阶段后才因缺表报 `500`

结论：

- `llm.read/create` 的入口权限校验没有正确校验 `teamId` 与当前 `tenantId` 的归属关系

---

## 7. 阶段结论

当前 AI 子需求**未通过第一阶段正确性测试**。

结论原因不是单一接口小问题，而是存在两个基础性阻断：

1. **AI 核心数据表未迁移到数据库**
2. **跨租户 teamId 作用域校验存在漏洞**

在这两个问题修复前，以下需求无法进入有效验收：

- AI 会话
- AI 消息历史
- Skill 执行
- 高风险确认流
- AI 记忆
- AI 审计

---

## 8. 建议修复顺序

1. 先应用 AI 相关 Prisma 迁移，确保 `ai_sessions / ai_messages / ai_skill_runs / ai_tool_calls / ai_audit_logs / ai_memories` 真正存在
2. 修复 `llm.read/create` 入口级权限校验中的跨租户 `teamId` 放行问题
3. 修复后重新执行本轮 Phase 1 AI 测试
4. 通过后再进入第二阶段回归与边界测试
