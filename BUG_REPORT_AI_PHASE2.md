# AI 子需求第二阶段 Bug 产出

## 1. 总览

来源：

- [TEST_REPORT_AI_PHASE2.md](/e:/AAAAsanxia/sanxia/saas/Saas/TEST_REPORT_AI_PHASE2.md)
- [.tmp/ai-phase2-results.json](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/ai-phase2-results.json)

统计：

- 失败项：`1`
- 高优 / 致命失败：`1`

结论：

- AI 第二阶段当前没有发现新的主链阻断问题
- 当前仅剩 **1 个边界拒绝语义不一致问题**
- 该问题不会导致越权成功，但会影响权限语义统一性与第二阶段验收通过

---

## 2. Bug 明细

### BUG-AI-P2-001 跨租户 `teamId` 在消息发送路径返回 `404`，未与其他 AI 入口统一为 `403`

严重级别：

- `High`

对应测试点：

- `A15`

现象：

- 使用 Owner 自有会话调用消息发送接口时，显式传入其他租户的 `teamId`
- 接口返回：
  - `404`
  - `Team not found`

期望结果：

- 该场景本质上属于跨租户访问拒绝
- 应与当前 AI 其他入口保持一致，返回 `403`

当前影响：

- 当前未发生数据读取、技能执行或工具调用越权
- 该问题主要体现在：
  - 鉴权拒绝语义不统一
  - 前端错误处理分支不稳定
  - 自动化测试与审计归类成本增加
  - 后续需求验收口径不一致

为什么仍记为 Bug：

- 第二阶段重点就是回归与边界一致性
- 即使系统已经“拒绝访问”，如果拒绝语义和其余入口不一致，仍属于可确认缺陷

可能关联位置：

- [llm.session.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.session.service.ts)
- [llm.authorization.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.authorization.service.ts)
- [llm.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/llm/llm.controller.ts)

修复建议：

- 收口消息发送路径中的 `teamId` 覆盖校验
- 当请求携带的 `teamId` 不属于当前 `tenantId` 时，直接返回 `403`
- 不要走“查询不到团队 -> 404”这一分支
- 与以下入口保持一致：
  - AI 会话创建
  - Skill 列表发现
  - Tool 列表发现
  - 其他已修复的跨租户拒绝路径

验收标准：

- 同样场景下接口返回 `403`
- 错误消息明确表达“跨租户访问不允许”或“无权限访问该团队”
- 修复后复跑 [.tmp/ai-phase2-test.mjs](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/ai-phase2-test.mjs) 应达到 `32/32` 全通过

---

## 3. 当前建议

建议将该问题直接交给实现 agent 修复，优先级可设为：

1. **本轮收尾立即修**
2. 修后直接复跑 AI 第二阶段脚本
3. 全通过后再进入 AI 第三阶段非功能验证
