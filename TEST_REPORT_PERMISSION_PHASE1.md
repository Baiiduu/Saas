# 权限子需求第一阶段测试报告

## 1. 测试结论

本次针对 [PERMISSION_SERVICE_REQUIREMENTS.md](/e:/AAAAsanxia/sanxia/saas/Saas/PERMISSION_SERVICE_REQUIREMENTS.md) 中已进入 `课程V1-收口版` 的权限子需求执行第一阶段正确性测试，重点覆盖：

- 企业 / 团队角色边界
- 关键接口的后端真实鉴权
- 资源级共享权限
- 租户 / 团队 / 资源作用域隔离
- AI 权限边界回归
- Audit 能力可用性
- 前后端权限语义对齐

结果：

- 测试点总数：`21`
- 通过：`7`
- 失败：`14`
- 高优 / 致命失败：`13`

结论：

- **权限子需求当前未通过第一阶段正确性测试**

---

## 2. 测试环境与方法

测试时间：

- `2026-05-08`

测试方式：

- 真实后端 HTTP 接口验证
- 结合数据库中已注入的测试账号 / 团队 / 资源进行权限校验
- 补充运行权限相关单元测试与前端权限单测，识别“单测通过但运行时失真”的情况

测试脚本与原始结果：

- [.tmp/permission-phase1-test.mjs](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/permission-phase1-test.mjs)
- [.tmp/permission-phase1-results.json](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/permission-phase1-results.json)

构建与单测补充结果：

- `pnpm --filter @saas/backend build` 通过
- `pnpm --filter frontend build` 通过
- `pnpm --filter @saas/backend test -- rbac.service.spec.ts tenant.guard.spec.ts rbac.guard.spec.ts llm.authorization.service.spec.ts --runInBand` 通过
- `pnpm --filter frontend test -- permission.spec.ts --runInBand` 通过

说明：

- 当前权限相关单元测试和前端权限单测均通过
- 但运行时 Phase 1 接口测试出现大量失败
- 这说明当前问题主要不是“没有单测”，而是**运行时权限接线与真实接口行为没有收口**

---

## 3. 测试数据

本轮沿用并校验了已有测试种子数据。

租户与团队：

- 主租户：`98178ecd-7a75-4eb8-ba8b-a444c395a010`
- 主团队：`2f2895e0-a781-4d45-b174-bf9fc8033ab1`
- 隔离租户：`11111111-1111-4111-8111-111111111111`

测试账号统一密码：

- `TestPass123!`

账号与角色：

- `2917781292@qq.com`
  - 租户角色：`OWNER`
  - 团队角色：`ADMIN`
- `ai.phase1.member@example.com`
  - 租户角色：`MEMBER`
  - 团队角色：`MEMBER`
- `ai.phase1.reader@example.com`
  - 租户角色：`READER`
  - 团队角色：`READER`
- `ai.phase1.guest@example.com`
  - 租户角色：`GUEST`
  - 团队角色：`GUEST`
- `ai.phase1.outsider@example.com`
  - 隔离租户账号，用于跨租户测试

核心资源：

- Owner 文档：`30000000-0000-4000-8000-000000000001`
- AI 测试任务、审批模板、里程碑等保留不变

本轮新增测试过程数据：

- 生成了文档 `edit` 共享链接
- 新增了若干临时测试任务、文件夹、团队记录

---

## 4. 通过项

以下测试点已通过：

- `P01` Owner 可以查看团队成员列表
- `P02` Member 不能修改其他成员角色
- `P03` Owner 可以修改并恢复 Guest 的团队角色
- `P04` Guest 权限映射显示无 `task/document/llm` 能力
- `P05` AI 技能列表已正确拦截跨租户 `teamId`
- `SETUP-01` 种子角色数据完整
- `SETUP-02` Owner 可生成文档共享链接

已确认的一点：

- AI 权限边界相对收口较好，`llm` 相关跨租户 `teamId` 校验仍然有效

---

## 5. 失败项摘要

### 5.1 角色边界未真正生效

以下账号虽然在权限映射中显示无权，但运行时接口仍被放行：

- `F01` Reader 创建任务返回 `201`
- `F02` Guest 创建任务返回 `201`
- `F03` Guest 创建文档目录返回 `201`
- `F06` Member 创建团队返回 `201`

这与子需求中的角色能力矩阵不一致，也与 `GET /api/v1/rbac/permissions/:userId` 返回值相矛盾。

### 5.2 文档共享与默认权限冲突

- `F04` Guest 在**不带任何 shareToken** 的情况下可直接读取 Owner 文档，返回 `200`
- `F05` Guest 携带 `edit` 共享链接尝试修改文档内容时却返回 `403`

说明当前共享权限能力存在“双向错位”：

- 未共享读取被错误放行
- 明确共享编辑却没有真正生效

### 5.3 租户边界未在关键业务接口收口

- `F07` 缺少 `x-tenant-id` 时，任务列表接口仍返回 `200`
- `F08` 跨租户账号可读取其他租户团队详情，返回 `200`
- `F09` 跨租户账号可读取其他租户任务列表，返回 `200`
- `F10` 跨租户账号可读取其他租户文档详情，返回 `200`

这属于多租户隔离级别的严重问题。

### 5.4 RBAC 检查接口自身不可用于上下文校验

- `F11` `POST /api/v1/rbac/check` 在带 `teamId` 时返回 `400`
- 错误信息显示：`property resourceId should not exist`、`property teamId should not exist`

这导致前端 / 测试 / 其他服务无法通过该接口完成资源上下文权限校验。

### 5.5 Audit 能力未达到可验收状态

- `F12` Owner 调用带分页参数的审计查询接口返回 `500`
- `F13` Guest 可以直接读取审计日志接口，返回 `200`
- `F14` 角色变更与共享操作后，审计日志总数仍为 `0`

说明 Audit 当前至少存在三类问题：

- 查询参数未正确转换
- 读取接口缺少权限保护
- 权限相关事件没有真正落审计

---

## 6. 关键观察

### 6.1 前后端权限语义已经对齐，但后端运行时没有真正执行到位

证据：

- 前端权限单测通过
- `rbac/permissions` 对 Guest 返回 `task.create=false`、`document.create=false`、`task.read=false`
- 但 Guest/Reader 真实访问任务、文档接口仍被放行

这说明当前最关键的问题不是“权限常量命名没对齐”，而是：

- **前端语义、权限矩阵、运行时接口行为三者不一致**

### 6.2 AI 模块权限边界优于常规业务模块

本轮中：

- AI 跨租户 `teamId` 校验通过
- 普通团队 / 任务 / 文档接口跨租户隔离失败

这说明 AI 模块近期修复已经收口，而普通业务模块的统一权限链仍未真正完成。

---

## 7. 阶段判断

对照 `PS01-PS09`，当前阶段判断如下：

- `PS02` 角色变更链路：部分可用
- `PS03` 统一接口级权限校验：未通过
- `PS04` 资源级共享权限：未通过
- `PS06` 权限继承、覆盖与作用域规则：未通过
- `PS07` AI 权限边界：当前抽样通过
- `PS08` 权限变更审计与拒绝日志：未通过
- `PS09` 前后端权限对齐：静态层面部分通过，运行时未通过

总体结论：

- **权限子需求当前仍处于“局部能力可见，但统一权限服务未完成真实收口”的状态**

---

## 8. 建议下一步

建议按以下顺序修复：

1. 先修复跨租户访问与缺失租户头放行问题
2. 再修复任务 / 文档 / 团队接口的真实后端鉴权失效问题
3. 收口文档共享读写逻辑，确保“未共享不读、edit 共享可写”
4. 修复 `rbac/check` 上下文 DTO 与 Audit 接口分页 / 鉴权问题
5. 补权限变更与拒绝日志落盘
6. 修完后重新执行权限子需求 Phase 1 回归

