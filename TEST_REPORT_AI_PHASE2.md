# AI 子需求第二阶段测试报告

## 1. 测试结论

本次基于真实 `LLM_API_KEY` 已配置的运行环境，执行 AI 子需求第二阶段回归与边界测试。

结果：

- 测试点总数：`32`
- 通过：`31`
- 失败：`1`
- 高优 / 致命失败：`1`

结论：

- **AI 子需求当前未完全通过第二阶段测试**
- 当前主链路、权限边界、确认流、记忆与审计能力整体可用
- 剩余问题集中在**跨租户 `teamId` 拒绝路径的状态码语义不一致**

---

## 2. 测试范围

本次测试覆盖：

- 真实模型调用与非模拟响应验证
- AI 会话创建、列表、详情、消息发送
- 会话私有性与多用户隔离
- Reader / Guest / outsider 权限边界
- 跨租户 `teamId` / `contextResourceId` / 非法输入校验
- Skill 列表与 Tool 列表发现
- `summary` / `weekly-report` / `task-suggestion` / `doc-draft` / `approval-assist`
- 待确认工具调用、确认执行、重复确认、过期确认
- AI 记忆生成与用户间隔离
- AI 审计日志落盘

测试脚本与原始结果：

- [.tmp/ai-phase2-test.mjs](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/ai-phase2-test.mjs)
- [.tmp/ai-phase2-results.json](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/ai-phase2-results.json)

---

## 3. 测试环境与数据

本次沿用第一阶段已确认可用的测试数据，并在真实模型环境下复跑：

- 主租户：`98178ecd-7a75-4eb8-ba8b-a444c395a010`
- 主团队：`2f2895e0-a781-4d45-b174-bf9fc8033ab1`
- 对照租户：`11111111-1111-4111-8111-111111111111`
- 角色账号：
  - `owner`
  - `member`
  - `reader`
  - `guest`
  - `outsider`

本次还确认了：

- 审批模板与参考审批记录可用于 `approval-assist`
- 任务与文档上下文资源可用于上下文会话测试
- 后端当前真实模型返回 `model=deepseek-v4-flash`

---

## 4. 已通过项

### 4.1 真实模型调用已生效

已验证：

- `POST /api/v1/llm/chat` 返回真实模型结果
- 响应内容不再包含 `[SIMULATED]`
- 测试提示词 `请只回复：AI-PHASE2-REAL` 被正确执行

说明：

- 当前 AI 主链已切换到真实推理路径

### 4.2 会话主链与消息主链可用

已验证：

- Owner 可创建带 `teamId + contextResourceType + contextResourceId` 的会话
- 会话列表可按团队返回新建会话
- 会话消息发送可返回真实回复并写入 `AiMessage`
- Member 可创建自己的 AI 会话
- Owner 不能读取 Member 私有会话，返回 `404`

说明：

- `AI01`、`AI02`、`AI06` 在第二阶段回归中保持可用

### 4.3 角色边界与大部分多租户边界正常

已验证：

- Reader 创建 AI 会话返回 `403`
- Guest 读取 Skill 列表返回 `403`
- outsider 使用其他租户 `teamId` 创建会话返回 `403`
- 非法 `contextResourceId` 返回 `400`
- 空消息体返回 `400`

说明：

- AI 入口权限、基础 DTO 校验、资源上下文校验整体正常

### 4.4 Skill 与 Tool 发现能力可用

已验证：

- Owner 可发现 Tool 列表
- Owner 可发现首批 Skill 列表
- 本次至少确认可用的 Skill 包含：
  - `summary`
  - `weekly-report`
  - `task-suggestion`
  - `doc-draft`
  - `approval-assist`

说明：

- `AI03` 当前具备第二阶段基础回归能力

### 4.5 Skill 执行主链可用

已验证：

- 未知 Skill 返回结构化失败，不会导致接口崩溃
- `summary` 在缺少团队上下文时返回结构化失败
- `summary` 在合法上下文下完成 `task.list`、`document.list`、`approval.list` 三步调用
- `weekly-report` 正常返回周报结构
- `task-suggestion` 正常返回建议列表
- `doc-draft` 能真实创建文档并写入草稿内容

说明：

- Skill 编排、工具调用和失败回传在第二阶段大体稳定

### 4.6 `approval-assist` 确认流闭环可用

已验证：

- 缺少模板时返回结构化失败
- 合法模板下返回 `pending_confirmation`
- 系统会落 `WAITING_CONFIRMATION` 的工具调用
- 非本人无法确认他人的待确认调用
- 本人确认后可正常执行
- 重复确认会被拒绝，不会重复执行
- 手工置为过期后返回 `Confirmation expired`

说明：

- `AI05`、`AI07` 关键确认链路当前可用

### 4.7 记忆与审计能力可用

已验证：

- Owner 第二轮对话后生成用户记忆
- Member 发送消息后生成自己的独立记忆
- Owner 与 Member 的 `AiMemory` 按 `userId` 隔离
- `AiAuditLog` 中已看到：
  - `session.created`
  - `model.call`
  - `skill.run`
  - `tool.call`
  - `confirmation.requested`

说明：

- `AI08`、`AI09` 在第二阶段已具备可验证的基础能力

---

## 5. 失败项

### 5.1 跨租户 `teamId` 在消息发送路径上的拒绝语义不一致

对应测试点：

- `A15`

现象：

- 在 Owner 自己的会话里发送消息时，手工传入其他租户的 `teamId`
- 接口没有放行，属于正确拒绝
- 但返回值为：
  - `404`
  - `message = Team not found`

期望：

- 与当前 AI 其他跨租户拒绝路径保持一致，返回 `403`

影响：

- 当前没有出现数据泄露或越权执行
- 但 AI 不同入口对“跨租户访问被拒绝”的语义不一致
- 会增加前端错误处理、自动化测试、审计归类与后续验收解释成本

判断：

- 这是**边界拒绝语义问题**
- 不是第一阶段那类“真实越权”
- 但在第二阶段回归口径下，仍应视为待修复问题

---

## 6. 补充验证

构建验证：

- `pnpm --filter @saas/backend build` 通过
- `pnpm --filter frontend build` 通过

运行态补充确认：

- 真实模型名：`deepseek-v4-flash`
- 本次对话与 Skill 执行均落库成功
- 前端打包通过，但仍有大 chunk 警告；这不属于本轮 AI 第二阶段失败项

---

## 7. 当前判断

对照 [AI_SERVICE_REQUIREMENTS.md](/e:/AAAAsanxia/sanxia/saas/Saas/AI_SERVICE_REQUIREMENTS.md)，当前第二阶段状态可以判断为：

- `AI01` 真实模型接入：第二阶段通过
- `AI02` 会话与历史主链：第二阶段通过
- `AI03` Skill / Tool 发现与执行：第二阶段通过
- `AI04` 权限与作用域边界：**接近通过，但仍有 1 个拒绝语义问题**
- `AI05` 确认执行流：第二阶段通过
- `AI06` 用户隔离与上下文作用域：第二阶段通过
- `AI07` 审批协助链路：第二阶段通过
- `AI08` 审计：第二阶段通过
- `AI09` 记忆：第二阶段通过

---

## 8. 后续建议

建议下一步按顺序处理：

1. 修复消息发送路径中跨租户 `teamId` 的返回语义，对齐为 `403`
2. 修复后复跑本测试脚本，目标应为 `32/32` 全通过
3. 通过后即可认为 AI 子需求第二阶段基本完成
4. 再进入第三阶段非功能验证，包括真实模型稳定性、超时、重试、日志和发布准备检查
