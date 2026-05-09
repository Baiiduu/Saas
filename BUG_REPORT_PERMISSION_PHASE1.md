# 权限子需求第一阶段 Bug 产出

## 1. 总览

来源：

- [TEST_REPORT_PERMISSION_PHASE1.md](/e:/AAAAsanxia/sanxia/saas/Saas/TEST_REPORT_PERMISSION_PHASE1.md)
- [.tmp/permission-phase1-results.json](/e:/AAAAsanxia/sanxia/saas/Saas/.tmp/permission-phase1-results.json)

统计：

- 失败项：`14`
- 高优 / 致命失败：`13`

结论：

- 当前权限子需求的主要问题集中在**后端真实鉴权未收口**
- 其中包含多租户隔离级别问题，应优先处理

---

## 2. 致命问题

### BUG-PERM-001 跨租户普通业务接口可直接读取其他租户数据

严重级别：

- `Critical`

对应测试点：

- `F08`
- `F09`
- `F10`

现象：

- `tenant2` 账号在携带自己的 `x-tenant-id` 时，仍可读取 `tenant1` 的：
  - 团队详情
  - 任务列表
  - 文档详情

实际结果：

- 全部返回 `200`

期望结果：

- 返回 `403`

影响：

- 直接破坏多租户数据隔离
- 使任务、文档、团队基础数据对其他租户泄露

证据位置：

- [team.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/team/team.service.ts:193)
- [task.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/task/task.service.ts:41)
- [document.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.service.ts:127)

备注：

- AI 模块的跨租户 `teamId` 已被修好
- 普通业务接口仍未同步收口

---

### BUG-PERM-002 缺少 `x-tenant-id` 时关键业务接口仍被放行

严重级别：

- `High`

对应测试点：

- `F07`

现象：

- 不携带 `x-tenant-id` 访问任务列表接口，仍返回 `200`

期望结果：

- 返回 `400`、`401` 或 `403`

影响：

- 租户上下文可以被绕过
- 导致后续权限链存在“默认放行”风险

证据位置：

- [tenant.guard.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/common/guards/tenant.guard.ts:42)

问题说明：

- `TenantGuard` 在缺少 `request.user?.sub` 或 `request.tenantId` 时直接 `return true`

---

## 3. 高优问题

### BUG-PERM-003 Reader / Guest 的任务创建权限在运行时失效

严重级别：

- `High`

对应测试点：

- `F01`
- `F02`

现象：

- Reader 创建任务返回 `201`
- Guest 创建任务返回 `201`

期望结果：

- 均应返回 `403`

影响：

- 角色能力矩阵失效
- `rbac/permissions` 与真实接口行为冲突

证据位置：

- [task.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/task/task.service.ts:41)
- [rbac.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/rbac/rbac.service.ts:650)

备注：

- `GET /api/v1/rbac/permissions/:userId` 对 Guest 返回 `task.create=false`
- 但实际创建接口被放行，属于前后端 / 权限矩阵 / 运行时三方失真

---

### BUG-PERM-004 Guest 的文档创建权限在运行时失效

严重级别：

- `High`

对应测试点：

- `F03`

现象：

- Guest 创建文档目录返回 `201`

期望结果：

- 返回 `403`

影响：

- 文档模块后端真实鉴权未按角色边界执行

证据位置：

- [document.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.service.ts:127)
- [rbac.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/rbac/rbac.service.ts:650)

---

### BUG-PERM-005 Guest 无共享时仍可直接读取 Owner 文档

严重级别：

- `High`

对应测试点：

- `F04`

现象：

- Guest 不带 `shareToken` 直接读取 Owner 文档详情，返回 `200`

期望结果：

- 返回 `403`

影响：

- 资源级共享未成为读取前提
- 文档默认权限边界被绕过

证据位置：

- [document.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.controller.ts:119)
- [document.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.service.ts:333)

---

### BUG-PERM-006 `edit` 共享链接不能真正写入文档

严重级别：

- `High`

对应测试点：

- `F05`

现象：

- Owner 生成 `permission=edit` 的共享链接后
- Guest 携带 `shareToken + accessCode` 调用文档保存接口，返回 `403`
- 错误信息为 `You can only modify your own documents`

期望结果：

- 应允许通过共享写入

影响：

- 共享权限只在读取层局部可见
- `edit` 共享无法形成真实业务能力

证据位置：

- [document.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.controller.ts:182)
- [document.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.service.ts:531)
- [document.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/document/document.service.ts:906)

---

### BUG-PERM-007 Member 被错误允许创建团队

严重级别：

- `High`

对应测试点：

- `F06`

现象：

- Member 创建团队返回 `201`

期望结果：

- 按权限子需求中的角色矩阵，应返回 `403`

影响：

- 团队创建边界与需求规格不一致
- 说明团队模块的真实鉴权没有与子需求收口

证据位置：

- [team.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/team/team.service.ts:114)
- [PERMISSION_SERVICE_REQUIREMENTS.md](/e:/AAAAsanxia/sanxia/saas/Saas/PERMISSION_SERVICE_REQUIREMENTS.md)

---

### BUG-PERM-008 `rbac/check` 不能携带 `teamId` / `resourceId`

严重级别：

- `High`

对应测试点：

- `F11`

现象：

- `POST /api/v1/rbac/check` 携带上下文字段时返回 `400`

错误信息：

- `property resourceId should not exist`
- `property teamId should not exist`

期望结果：

- 返回 `200`
- 并可对团队 / 资源上下文做权限判定

影响：

- 前端能力探测接口不可用于真实上下文权限判断
- 测试和其他服务无法复用该接口

证据位置：

- [rbac.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/rbac/rbac.controller.ts:30)

问题说明：

- `CheckPermissionBody` 中 `resourceId` / `teamId` 未声明校验装饰器
- 在 whitelist + forbidNonWhitelisted 下被当成非法字段

---

### BUG-PERM-009 Audit 查询接口分页参数导致 500

严重级别：

- `Medium`

对应测试点：

- `F12`

现象：

- Owner 调用 `GET /audit-logs?tenantId=...&limit=1` 返回 `500`

根因特征：

- `limit` 被以字符串传给 Prisma `take`

证据位置：

- [audit.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/audit/audit.service.ts:91)
- [audit.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/audit/audit.service.ts:120)

---

### BUG-PERM-010 Guest 可直接读取 Audit 日志

严重级别：

- `High`

对应测试点：

- `F13`

现象：

- Guest 调用审计日志查询接口返回 `200`

期望结果：

- 返回 `403`

影响：

- 审计数据属于敏感治理数据
- 当前接口缺少与 `audit.read` 对应的真实后端鉴权

证据位置：

- [audit.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/audit/audit.controller.ts:22)

问题说明：

- Controller 上没有权限守卫或显式 `rbacService.assertPermission('audit.read', ...)`

---

### BUG-PERM-011 权限变更与共享操作未产生 Audit 记录

严重级别：

- `High`

对应测试点：

- `P03`
- `SETUP-02`
- `F14`

现象：

- Owner 已执行角色变更和文档共享操作
- 但 `GET /audit-logs?tenantId=...` 返回 `total=0`

期望结果：

- 至少应记录角色变更、共享变更或权限相关动作

影响：

- `PS08` 无法验收
- 权限治理不可追溯

证据位置：

- [audit.controller.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/audit/audit.controller.ts:26)
- [audit.service.ts](/e:/AAAAsanxia/sanxia/saas/Saas/packages/backend/src/modules/audit/audit.service.ts:37)

---

## 4. 结构性结论

### 4.1 当前最核心的问题不是“权限表没写”，而是“真实接口没有统一接上权限链”

证据：

- 权限矩阵存在
- 前端权限单测通过
- `rbac/permissions` 返回值看起来合理
- 但任务 / 文档 / 团队运行时大量越权放行

### 4.2 AI 权限链和普通业务权限链存在实现割裂

证据：

- AI 跨租户 `teamId` 已被正确拦截
- 任务 / 文档 / 团队同类边界仍然失效

说明：

- 统一权限服务尚未真正成为“全局公共鉴权层”

---

## 5. 修复优先级建议

建议按以下顺序修复：

1. `BUG-PERM-001`
2. `BUG-PERM-002`
3. `BUG-PERM-003`
4. `BUG-PERM-004`
5. `BUG-PERM-005`
6. `BUG-PERM-006`
7. `BUG-PERM-010`
8. `BUG-PERM-011`
9. `BUG-PERM-008`
10. `BUG-PERM-009`
11. `BUG-PERM-007`

