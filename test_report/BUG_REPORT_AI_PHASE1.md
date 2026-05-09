# AI 子需求第一阶段 Bug 报告

## AI-BUG-001

| 字段 | 内容 |
|------|------|
| 标题 | AI 核心数据表未落库，导致 AI 会话 / Skill / 记忆主链全部不可用 |
| 等级 | 阻断 |
| 范围 | 后端 / 数据库 / AI 全链路 |
| 发现阶段 | AI 子需求第一阶段正确性测试 |
| 关联测试点 | `AI-P1-SESSION-01` `AI-P1-CHAT-01` `AI-P1-SESSION-02` `AI-P1-SESSION-03` `AI-P1-SKILL-02` `AI-P1-CONFIRM-01` `AI-P1-MEM-01` |
| 现象 | 创建 AI 会话、发送消息、执行 Skill、读取记忆均返回 `500` 或直接报表不存在 |
| 直接证据 | `tenant.ai_sessions` 不存在；`tenant.ai_skill_runs` 不存在；`tenant.ai_memories` 不存在 |
| 进一步证据 | `pnpm --filter @saas/backend exec prisma migrate status` 显示 `20260508083000_ai_services` 与 `20260508113000_ai_memory_foundation` 未应用 |
| 影响 | AI 会话、消息、Skill、确认流、记忆、专项审计都无法进入真实验收 |
| 可能原因 | 代码和 Prisma schema 已更新，但 AI 相关迁移未执行到当前数据库 |
| 建议修复 | 先执行 AI 相关数据库迁移，再重跑 Phase 1 测试 |
| 相关位置 | [llm.session.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.session.service.ts:32) [llm.skill.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.skill.service.ts:97) [llm.memory.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.memory.service.ts:27) |

---

## AI-BUG-002

| 字段 | 内容 |
|------|------|
| 标题 | AI 入口权限校验存在跨租户 `teamId` 放行漏洞 |
| 等级 | 高 |
| 范围 | 后端权限 / 多租户边界 / AI Tool & Skill 发现接口 |
| 发现阶段 | AI 子需求第一阶段正确性测试 |
| 关联测试点 | `AI-P1-PERM-04` `AI-P1-PERM-05` `AI-P1-PERM-06` |
| 现象 | `tenant2` 的 `Owner` 用户传入 `tenant1` 的 `teamId` 后，可以成功获取 `tenant1` 团队的 Skill 列表和 Tool 列表；创建 session 请求也没有先被 `403` 拒绝 |
| 期望行为 | 只要 `teamId` 不属于当前 `tenantId`，应在入口级权限校验直接拒绝 |
| 实际行为 | `canAccessPermission()` 走 `getEffectiveTeamRole()` 时，对 `Owner/Admin` 仅凭租户角色直接返回放行，没有先校验 `teamId` 是否属于当前租户 |
| 风险 | 会导致跨租户上下文泄露、能力错误展示、后续执行链路前后不一致 |
| 建议修复 | 在 `llm.read/create` 这类入口校验中，若传入 `teamId`，必须先校验该团队是否属于当前租户，再计算有效角色 |
| 相关位置 | [llm.authorization.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.authorization.service.ts:18) [llm.authorization.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.authorization.service.ts:251) [llm.session.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.session.service.ts:30) |

---

## AI-BUG-003

| 字段 | 内容 |
|------|------|
| 标题 | AI Tool / Skill 发现链路与真实执行链路存在不一致风险 |
| 等级 | 中 |
| 范围 | 后端权限 / 前后端能力展示 |
| 发现阶段 | AI 子需求第一阶段正确性测试 |
| 关联测试点 | `AI-P1-PERM-04` `AI-P1-PERM-05` |
| 现象 | 在跨租户 `teamId` 场景下，`/llm/skills` 和 `/llm/mcp/tools` 已经把能力暴露给了不该看到的用户，但真正执行业务工具时，执行链中又有更严格的租户校验 |
| 影响 | 前端会看到错误能力，用户会拿到“可见但不可执行”的假能力，验收时会表现为前后端错位 |
| 建议修复 | Tool/Skill 列表过滤必须复用与执行阶段一致的租户和团队归属判断，不能只做角色级判断 |
| 相关位置 | [llm.authorization.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.authorization.service.ts:18) [mcp.tool-registry.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/mcp/mcp.tool-registry.ts:63) [llm.skill.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.skill.service.ts:18) |

---

## AI-BUG-004

| 字段 | 内容 |
|------|------|
| 标题 | AI 审计结果当前无法形成有效验证闭环 |
| 等级 | 中 |
| 范围 | 后端审计 / AI 可追溯性 |
| 发现阶段 | AI 子需求第一阶段正确性测试 |
| 关联测试点 | `AI-P1-AUDIT-01` |
| 现象 | Owner / Member 会话没有产生可供验收的 AI 审计数据 |
| 根因判断 | 该问题是 `AI-BUG-001` 的级联结果，主链未跑通导致审计无从落盘 |
| 建议修复 | 先修复 AI 表迁移问题，再回归验证 `session.created / model.call / skill.run / tool.call / confirmation.requested` 是否完整落库 |
| 相关位置 | [llm.audit.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.audit.service.ts:18) |
