# AI 子需求第一阶段复检报告

## 1. 复检结论

本次基于与第一次 Phase 1 相同的测试口径、相同测试账号、相同测试数据重新执行 AI 子需求第一阶段正确性测试。

结果：

- 测试点总数：`21`
- 通过：`21`
- 失败：`0`
- 高优先级失败：`0`

结论：

- **AI 子需求当前已通过第一阶段正确性测试**

---

## 2. 已确认修复项

### 2.1 AI 数据表已真实落库

已确认存在：

- `tenant.ai_sessions`
- `tenant.ai_messages`
- `tenant.ai_skill_runs`
- `tenant.ai_tool_calls`
- `tenant.ai_audit_logs`
- `tenant.ai_memories`

并且：

- `pnpm --filter @saas/backend exec prisma migrate status` 返回数据库已是最新状态

### 2.2 AI 会话主链已打通

已验证：

- 创建 session 成功
- 发送消息成功
- 获取 session 详情成功
- 历史消息可读取

### 2.3 Skill 与确认流已打通

已验证：

- `doc-draft` 可正常执行
- `approval-assist` 可产生待确认操作
- 待确认 tool call 可读取
- 确认后审批成功创建
- 确认后待处理列表归零

### 2.4 权限与租户边界已收口

已验证：

- `Reader` 被 `llm.read` 正确拒绝
- `Guest` 被 `llm.create` 正确拒绝
- 非本人 session 无法被其他成员读取
- 跨租户传入其他租户 `teamId` 时，skills/tools/session 入口均返回：
  - `403`
  - `Cross-tenant team access is not allowed`

### 2.5 记忆与审计已落地

已验证：

- `AiMemory` 已写入用户近期意图记忆
- `AiAuditLog` 已记录：
  - `session.created`
  - `model.call`
  - `tool.call`
  - `skill.run`
  - `confirmation.requested`

### 2.6 前端权限命名已对齐

已确认当前前端使用：

- 路由守卫：`llm.read`
- 页面内权限：`llm.read` / `llm.create`
- 侧边栏显隐：`llm.read`

与共享权限常量一致，不再使用旧的 `llm.view` / `llm.use`。

---

## 3. 验证补充

构建验证：

- `pnpm --filter @saas/backend build` 通过
- `pnpm --filter frontend build` 通过

运行时说明：

- 当前 `LLM_API_KEY` 仍为空，因此聊天回复走的是**模拟响应**
- 这不影响第一阶段正确性测试结论，因为本阶段验证的是：
  - 会话链路
  - 权限链路
  - Skill 链路
  - 确认流
  - 记忆与审计落盘

---

## 4. 当前剩余风险

虽然第一阶段已经通过，但仍有一个需要单独说明的残余点：

- 当前并未接入真实 LLM 提供商响应验证
- 因此 Phase 1 通过不等于“真实模型质量已验收”

这属于后续测试范围，不属于本轮阻断项。

---

## 5. 建议下一步

建议进入：

1. **AI 第二阶段回归与边界测试**
2. 补做真实 `LLM_API_KEY` 条件下的模型调用验证
3. 针对权限、确认流、memory/audit 做回归测试固化
