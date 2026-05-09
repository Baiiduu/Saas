# AI 子需求完成度检查报告

## 1. 检查范围

本次检查以 [AI_SERVICE_REQUIREMENTS.md](AI_SERVICE_REQUIREMENTS.md) 为基准，对 AI 模块当前代码实现进行“需求落实度检查”，重点核对：

- 需求是否已落到前端、后端、数据模型
- 是否存在权限或作用域偏差
- 是否具备基础可验收条件

本次不包含压力测试、性能测试和人工产品体验评审。

---

## 2. 总体结论

当前 AI 模块已经不是演示态，已经形成了较完整的基础实现：

- 已完整落实：`AI01`、`AI02`、`AI03`、`AI07`
- 已部分落实：`AI04`、`AI05`、`AI06`、`AI08`、`AI09`
- 未发现“完全未做”的主需求项

完成度判断：

- **基础版完成度约 75%**
- **全量规格完成度约 65% ~ 70%**

阶段判断：

- 已进入“**可用基础版**”状态
- 还**不能视为按需求文档完全验收通过**
- 主要短板集中在：`权限细节收口`、`前端工作台完整性`、`上下文/记忆能力`、`需求与权限术语统一`

---

## 3. 需求落实矩阵

| 需求 ID | 完成度 | 结论 |
|---------|--------|------|
| AI01 | 已完整落实 | 已支持真实 AI 会话创建、统一后端模型调用、结果回写 |
| AI02 | 已完整落实 | 已支持会话持久化、历史恢复、继续对话 |
| AI03 | 已完整落实 | 已支持 MCP Tool 注册、统一发现、按上下文过滤返回 |
| AI04 | 已部分落实 | 已有统一权限执行链，但仍存在权限收口缺口 |
| AI05 | 已部分落实 | 后端 Skill 体系已成型，但前端入口未覆盖全部首批 Skill |
| AI06 | 已部分落实 | 已有即时上下文和会话历史，但长期记忆与共享记忆未落地 |
| AI07 | 已完整落实 | 已有 AI 审计、权限拒绝记录、高风险确认流 |
| AI08 | 已部分落实 | 已有真实 AI 工作台，但仍有能力缺口 |
| AI09 | 已部分落实 | 核心 AI 表和服务已建立，但记忆层与服务边界仍未完全齐备 |

---

## 4. 分项检查

### AI01 - AI 会话与模型接入

**完成度：已完整落实**

落实证据：

- 后端已提供会话创建与消息发送接口：`GET/POST /llm/sessions`、`POST /llm/sessions/:sessionId/messages`
- 模型调用统一经过后端 `LlmService`
- 会话消息已经落库到 `AiSession` / `AiMessage`

对应实现：

- `packages/backend/src/modules/llm/llm.controller.ts`
- `packages/backend/src/modules/llm/llm.session.service.ts`
- `packages/backend/src/modules/llm/llm.service.ts`
- `packages/backend/prisma/schema.prisma`

结论：

- 已满足“前端不直连模型、统一后端调用、会话落盘”的基础要求

### AI02 - AI 会话历史与恢复

**完成度：已完整落实**

落实证据：

- 已有会话列表接口
- 已有会话详情接口
- 页面刷新后可从后端重新拉取会话和消息
- 会话按 `lastActiveAt` 排序

对应实现：

- `packages/backend/src/modules/llm/llm.session.service.ts`
- `packages/frontend/src/services/llmService.ts`
- `packages/frontend/src/pages/llm/ChatPage.tsx`

结论：

- 已满足“历史恢复、继续对话、最近会话恢复”的基础要求

### AI03 - MCP 工具注册与发现

**完成度：已完整落实**

落实证据：

- 已建立统一 `MCPToolRegistry`
- 已支持工具注册、查询、按上下文过滤
- 已提供前端工具列表接口 `GET /llm/mcp/tools`
- 首批工具范围已包含任务、文档、审批、成员、里程碑等对象

对应实现：

- `packages/backend/src/modules/llm/mcp/mcp.tool-registry.ts`
- `packages/backend/src/modules/llm/mcp/mcp.tool-bootstrap.service.ts`
- `packages/backend/src/modules/llm/llm.controller.ts`

结论：

- 已满足“工具注册与发现统一收口”的基础要求

### AI04 - AI 权限范围内的数据读取与写入

**完成度：已部分落实**

已落实部分：

- 工具执行统一经过 `LlmAuthorizationService`
- 已检查租户成员关系
- 已解析目标团队与资源归属
- 已对任务、文档、审批、成员、里程碑、LLM 做最小角色判断
- 已增加任务更新、文档更新的所有权约束

对应实现：

- `packages/backend/src/modules/llm/llm.authorization.service.ts`
- `packages/backend/src/modules/llm/mcp/mcp.tool-registry.ts`

主要缺口：

- 文档共享放行逻辑只判断“是否存在共享记录”，没有校验“该共享是否与当前用户/当前访问身份有关”
- 权限术语未完全统一：前端权限矩阵使用 `llm.view` / `llm.use`，后端 Skill 权限使用 `llm.read` / `llm.create`
- 当前权限矩阵覆盖的资源域仍然有限，未形成真正统一的资源级权限框架

结论：

- 已经有“统一执行链”，但**还不能判定为完全满足 AI 权限等同于用户真实权限**

### AI05 - Skill 编排执行

**完成度：已部分落实**

已落实部分：

- 已建立 `SkillRegistry`
- 已提供 Skill 列表与执行接口
- 已有首批 Skill：`summary`、`weekly-report`、`task-suggestion`、`doc-draft`、`approval-assist`
- Skill 运行结果、步骤、错误、待确认状态已落库

对应实现：

- `packages/backend/src/modules/llm/skills`
- `packages/backend/src/modules/llm/llm.skill.service.ts`
- `packages/backend/src/modules/llm/llm.controller.ts`

主要缺口：

- 前端快捷入口只暴露了 `summary`、`weekly-report`、`task-suggestion`、`doc-draft`
- `approval-assist` 在前端仍没有完整参数表单入口，页面当前直接提示“未提供表单入口”

结论：

- 后端 Skill 主体已形成，但“首批 Skill 前后端闭环”还未完全达成

### AI06 - AI 上下文构建与历史记忆

**完成度：已部分落实**

已落实部分：

- 已注入租户、用户、团队基础上下文
- 会话发送消息时会附带 `sessionId`、当前资源类型/资源 ID、消息数量等即时元数据
- 会话历史已持久化，可用于短期上下文回放

对应实现：

- `packages/backend/src/modules/llm/mcp/mcp.context-builder.ts`
- `packages/backend/src/modules/llm/llm.session.service.ts`

主要缺口：

- 未发现 `AiMemory` 数据模型
- 未发现长期记忆、用户偏好、团队共享记忆、会话摘要持久化
- 上下文构建仍以“租户/用户/团队基础信息”为主，未形成“最近资源、偏好、共享记忆”层

结论：

- 已实现即时上下文，但距离需求文档中的“历史记忆能力”还有明显差距

### AI07 - AI 操作审计与确认机制

**完成度：已完整落实**

落实证据：

- 已记录 `session.created`、`model.call`、`skill.run`、`tool.call`、`permission.denied`
- 高风险工具支持 `WAITING_CONFIRMATION`
- 已有确认接口 `POST /llm/tool-calls/:toolCallId/confirm`
- 确认时校验用户和租户归属、确认过期时间、待确认状态

对应实现：

- `packages/backend/src/modules/llm/llm.audit.service.ts`
- `packages/backend/src/modules/llm/mcp/mcp.tool-registry.ts`
- `packages/backend/src/modules/llm/llm.controller.ts`

结论：

- 已满足“可追溯 + 高风险确认流”的基础要求

### AI08 - AI 前端工作台

**完成度：已部分落实**

已落实部分：

- AI 页面已从演示聊天页升级为真实会话工作台
- 已支持会话列表、消息区、输入区、快捷 Skill、待确认操作、错误提示
- 页面路由已挂 `PermissionGuard`
- 页面已接真实会话接口，不再依赖纯页面内存

对应实现：

- `packages/frontend/src/pages/llm/ChatPage.tsx`
- `packages/frontend/src/services/llmService.ts`
- `packages/frontend/src/router/index.tsx`

主要缺口：

- 前端没有完整展示全部 Skill，仅展示快捷 Skill 子集
- `approval-assist` 未提供表单化触发入口
- 工具步骤当前主要以消息 `Tag` 形式展示，仍偏轻量

结论：

- 已达到“可用工作台”标准，但还没有完整达到文档设想的“完整 AI 工作台”

### AI09 - AI 数据模型与服务边界

**完成度：已部分落实**

已落实部分：

- 已建立 `AiSession`、`AiMessage`、`AiSkillRun`、`AiToolCall`、`AiAuditLog`
- 已拆出 `LlmSessionService`、`LlmSkillService`、`LlmAuthorizationService`、`LlmAuditService`
- 工具注册、上下文构建、Skill 编排已形成独立职责

对应实现：

- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/modules/llm`

主要缺口：

- 未发现 `AiMemory`
- 未形成独立记忆服务
- 需求文档里的“上下文、记忆、数据模型”三层边界还未完全闭环

结论：

- AI 正式数据模型已经落地，但完整服务边界还未全部收束

---

## 5. 主要问题清单

### 高优先级

1. **AI 文档读权限存在放行过宽风险**

现状：

- `LlmAuthorizationService.hasDocumentShareOverride()` 只判断文档是否存在未过期共享记录
- 它没有判断该共享是否与当前用户、当前来路或具体共享凭证相关

影响：

- 可能导致“只要文档存在共享链接，AI 就把它当成当前登录用户可读”
- 这不满足“AI 权限严格等同于当前用户真实权限”的需求要求

建议：

- AI 权限链不要直接把“存在共享记录”视作“当前用户有读权限”
- 应复用正式文档访问判定逻辑，显式校验当前主体是否被授权

2. **AI 权限命名体系未统一**

现状：

- 前端权限矩阵：`llm.view`、`llm.use`
- 后端 Skill 权限：`llm.read`、`llm.create`

影响：

- 当前虽然角色门槛同为 `MEMBER`，短期未必出错
- 但会造成前后端权限语义漂移，后续非常容易出现路由可见但后端拒绝，或反向放行的情况

建议：

- 统一 LLM 权限命名
- 统一共享类型包、前端路由守卫、后端 AI 鉴权矩阵

### 中优先级

3. **首批 Skill 尚未完成前端闭环**

现状：

- 后端已注册 `approval-assist`
- 前端未提供执行参数入口

影响：

- 需求文档里的首批 Skill 能力未完成端到端落实

4. **AI 记忆层未落地**

现状：

- 无 `AiMemory`
- 无用户偏好/共享记忆/会话摘要持久化

影响：

- 当前 AI 更接近“有历史会话的短上下文工作台”，还不是“有记忆的协作助手”

5. **缺少 AI 专项自动化测试证据**

现状：

- 未发现 AI/LLM 模块专门测试文件

影响：

- 当前完成度更多是“实现完成度”
- 还不是“有充分自动化验收证据的完成度”

---

## 6. 验证记录

本次补做了最小构建验证：

- `pnpm --filter @saas/backend build`：通过
- `pnpm --filter frontend build`：通过

补充说明：

- 未发现 AI 模块专门测试用例文件
- 因此本次结论主要基于“代码实现追踪 + 构建通过 + 需求对照”

---

## 7. 最终判断

如果按“另一个 agent 已经把 AI 做完”来判断，结论应当是：

- **AI 基础主链已经做出来了**
- **但按需求文档严格对照，还没有完全做完**

更准确的说法是：

- 可以进入**第一轮 AI 正确性测试**
- 可以进入**权限与前端闭环修补**
- 暂时**不建议直接宣布需求完全验收通过**

优先修复顺序建议：

1. 修 AI 权限链中的文档共享放行问题
2. 统一 AI 权限命名
3. 补齐 `approval-assist` 前端入口
4. 补 AI 记忆层模型与服务
5. 增加 AI 专项测试
