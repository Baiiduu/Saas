/**
 * Runtime validation test for @saas/shared-types
 *
 * This script imports the compiled dist output and verifies:
 *  - All 9 enums with correct string values
 *  - All 14 interfaces are valid TS types (via .d.ts check)
 *  - Constants (ROLE_HIERARCHY, PERMISSION_MATRIX, VALID_STATUS_TRANSITIONS, STATUS_ORDER)
 *  - Barrel exports are complete
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Import compiled output
const shared = require(resolve(__dirname, '..', 'dist', 'index'));

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ ${description}`);
  }
}

function assertDeepEqual(actual, expected, description) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ ${description}`);
    console.error(`      expected: ${e}`);
    console.error(`      actual:   ${a}`);
  }
}

console.log('\n=== Enum Validation ===\n');

// 1. TaskStatus (4 values)
assert(shared.TaskStatus, 'TaskStatus enum exists');
assertDeepEqual(Object.keys(shared.TaskStatus), ['TODO', 'IN_PROGRESS', 'DONE', 'CLOSED'], 'TaskStatus has 4 keys');
assert(shared.TaskStatus.TODO === 'todo', 'TaskStatus.TODO = "todo"');
assert(shared.TaskStatus.IN_PROGRESS === 'in_progress', 'TaskStatus.IN_PROGRESS = "in_progress"');
assert(shared.TaskStatus.DONE === 'done', 'TaskStatus.DONE = "done"');
assert(shared.TaskStatus.CLOSED === 'closed', 'TaskStatus.CLOSED = "closed"');

// 2. Priority (4 values)
assert(shared.Priority, 'Priority enum exists');
assert(shared.Priority.LOW === 'low', 'Priority.LOW = "low"');
assert(shared.Priority.MEDIUM === 'medium', 'Priority.MEDIUM = "medium"');
assert(shared.Priority.HIGH === 'high', 'Priority.HIGH = "high"');
assert(shared.Priority.URGENT === 'urgent', 'Priority.URGENT = "urgent"');

// 3. Role (6 values)
assert(shared.Role, 'Role enum exists');
assert(shared.Role.OWNER === 'owner', 'Role.OWNER = "owner"');
assert(shared.Role.ADMIN === 'admin', 'Role.ADMIN = "admin"');
assert(shared.Role.LEADER === 'leader', 'Role.LEADER = "leader"');
assert(shared.Role.MEMBER === 'member', 'Role.MEMBER = "member"');
assert(shared.Role.READER === 'reader', 'Role.READER = "reader"');
assert(shared.Role.GUEST === 'guest', 'Role.GUEST = "guest"');

// 4. ApprovalStatus (4 values)
assert(shared.ApprovalStatus, 'ApprovalStatus enum exists');
assert(shared.ApprovalStatus.PENDING === 'pending', 'ApprovalStatus.PENDING = "pending"');
assert(shared.ApprovalStatus.APPROVED === 'approved', 'ApprovalStatus.APPROVED = "approved"');
assert(shared.ApprovalStatus.REJECTED === 'rejected', 'ApprovalStatus.REJECTED = "rejected"');
assert(shared.ApprovalStatus.CANCELED === 'canceled', 'ApprovalStatus.CANCELED = "canceled"');

// 5. NotificationType (8 values)
assert(shared.NotificationType, 'NotificationType enum exists');
assert(shared.NotificationType.TASK_ASSIGNED === 'task_assigned', 'NotificationType.TASK_ASSIGNED = "task_assigned"');
assert(shared.NotificationType.COMMENT_MENTION === 'comment_mention', 'NotificationType.COMMENT_MENTION = "comment_mention"');
assert(shared.NotificationType.APPROVAL_NEEDED === 'approval_needed', 'NotificationType.APPROVAL_NEEDED = "approval_needed"');
assert(shared.NotificationType.APPROVAL_RESULT === 'approval_result', 'NotificationType.APPROVAL_RESULT = "approval_result"');
assert(shared.NotificationType.DOCUMENT_SHARED === 'document_shared', 'NotificationType.DOCUMENT_SHARED = "document_shared"');
assert(shared.NotificationType.MEMBER_JOINED === 'member_joined', 'NotificationType.MEMBER_JOINED = "member_joined"');
assert(shared.NotificationType.TEAM_INVITE === 'team_invite', 'NotificationType.TEAM_INVITE = "team_invite"');
assert(shared.NotificationType.MILESTONE_DUE === 'milestone_due', 'NotificationType.MILESTONE_DUE = "milestone_due"');
assertDeepEqual(Object.keys(shared.NotificationType).length, 8, 'NotificationType has 8 members');

// 6. ResourceType (3 values)
assert(shared.ResourceType, 'ResourceType enum exists');
assert(shared.ResourceType.GIT_REPO === 'git_repo', 'ResourceType.GIT_REPO = "git_repo"');
assert(shared.ResourceType.S3_BUCKET === 's3_bucket', 'ResourceType.S3_BUCKET = "s3_bucket"');
assert(shared.ResourceType.FILE === 'file', 'ResourceType.FILE = "file"');

// 7. TeamVisibility (2 values)
assert(shared.TeamVisibility, 'TeamVisibility enum exists');
assert(shared.TeamVisibility.PUBLIC === 'public', 'TeamVisibility.PUBLIC = "public"');
assert(shared.TeamVisibility.PRIVATE === 'private', 'TeamVisibility.PRIVATE = "private"');

// 8. DocumentType (2 values)
assert(shared.DocumentType, 'DocumentType enum exists');
assert(shared.DocumentType.FOLDER === 'folder', 'DocumentType.FOLDER = "folder"');
assert(shared.DocumentType.FILE === 'file', 'DocumentType.FILE = "file"');

// 9. MessageType (4 values)
assert(shared.MessageType, 'MessageType enum exists');
assert(shared.MessageType.TEXT === 'text', 'MessageType.TEXT = "text"');
assert(shared.MessageType.IMAGE === 'image', 'MessageType.IMAGE = "image"');
assert(shared.MessageType.FILE === 'file', 'MessageType.FILE = "file"');
assert(shared.MessageType.SYSTEM === 'system', 'MessageType.SYSTEM = "system"');

// Count enums at top level
const enumNames = ['TaskStatus', 'Priority', 'Role', 'ApprovalStatus', 'NotificationType', 'ResourceType', 'TeamVisibility', 'DocumentType', 'MessageType'];
for (const name of enumNames) {
  assert(typeof shared[name] === 'object' && shared[name] !== null, `${name} is exported from barrel`);
}
assert(enumNames.length === 9, 'All 9 enums are defined');

console.log('\n=== Constants Validation ===\n');

// ROLE_HIERARCHY
assert(shared.ROLE_HIERARCHY, 'ROLE_HIERARCHY exists');
assert(typeof shared.ROLE_HIERARCHY === 'object', 'ROLE_HIERARCHY is an object');
assertDeepEqual(Object.keys(shared.ROLE_HIERARCHY).length, 6, 'ROLE_HIERARCHY has 6 entries');
assert(shared.ROLE_HIERARCHY[shared.Role.OWNER] === 6, 'OWNER = 6');
assert(shared.ROLE_HIERARCHY[shared.Role.ADMIN] === 5, 'ADMIN = 5');
assert(shared.ROLE_HIERARCHY[shared.Role.LEADER] === 4, 'LEADER = 4');
assert(shared.ROLE_HIERARCHY[shared.Role.MEMBER] === 3, 'MEMBER = 3');
assert(shared.ROLE_HIERARCHY[shared.Role.READER] === 2, 'READER = 2');
assert(shared.ROLE_HIERARCHY[shared.Role.GUEST] === 1, 'GUEST = 1');

// PERMISSION_MATRIX
assert(shared.PERMISSION_MATRIX, 'PERMISSION_MATRIX exists');
const perms = Object.keys(shared.PERMISSION_MATRIX);
assert(perms.length === 38, `PERMISSION_MATRIX has 38 entries (got ${perms.length})`);

// Spot-check key permissions
assert(shared.PERMISSION_MATRIX['tenant.update'] === shared.Role.OWNER, 'tenant.update requires OWNER');
assert(shared.PERMISSION_MATRIX['tenant.delete'] === shared.Role.OWNER, 'tenant.delete requires OWNER');
assert(shared.PERMISSION_MATRIX['tenant.invite'] === shared.Role.ADMIN, 'tenant.invite requires ADMIN');
assert(shared.PERMISSION_MATRIX['team.create'] === shared.Role.LEADER, 'team.create requires LEADER');
assert(shared.PERMISSION_MATRIX['team.delete'] === shared.Role.OWNER, 'team.delete requires OWNER');
assert(shared.PERMISSION_MATRIX['team.add_member'] === shared.Role.LEADER, 'team.add_member requires LEADER');
assert(shared.PERMISSION_MATRIX['task.create'] === shared.Role.MEMBER, 'task.create requires MEMBER');
assert(shared.PERMISSION_MATRIX['task.assign'] === shared.Role.LEADER, 'task.assign requires LEADER');
assert(shared.PERMISSION_MATRIX['task.view'] === shared.Role.READER, 'task.view requires READER');
assert(shared.PERMISSION_MATRIX['audit.view'] === shared.Role.ADMIN, 'audit.view requires ADMIN');
assert(shared.PERMISSION_MATRIX['dashboard.view'] === shared.Role.MEMBER, 'dashboard.view requires MEMBER');

// VALID_STATUS_TRANSITIONS
assert(shared.VALID_STATUS_TRANSITIONS, 'VALID_STATUS_TRANSITIONS exists');
assertDeepEqual(shared.VALID_STATUS_TRANSITIONS[shared.TaskStatus.TODO], [shared.TaskStatus.IN_PROGRESS], 'TODO -> IN_PROGRESS');
assertDeepEqual(shared.VALID_STATUS_TRANSITIONS[shared.TaskStatus.IN_PROGRESS], [shared.TaskStatus.DONE, shared.TaskStatus.TODO], 'IN_PROGRESS -> DONE, TODO');
assertDeepEqual(shared.VALID_STATUS_TRANSITIONS[shared.TaskStatus.DONE], [shared.TaskStatus.CLOSED, shared.TaskStatus.IN_PROGRESS], 'DONE -> CLOSED, IN_PROGRESS');
assertDeepEqual(shared.VALID_STATUS_TRANSITIONS[shared.TaskStatus.CLOSED], [shared.TaskStatus.TODO], 'CLOSED -> TODO');

// STATUS_ORDER
assert(shared.STATUS_ORDER, 'STATUS_ORDER exists');
assert(shared.STATUS_ORDER[shared.TaskStatus.TODO] === 0, 'TODO = 0');
assert(shared.STATUS_ORDER[shared.TaskStatus.IN_PROGRESS] === 1, 'IN_PROGRESS = 1');
assert(shared.STATUS_ORDER[shared.TaskStatus.DONE] === 2, 'DONE = 2');
assert(shared.STATUS_ORDER[shared.TaskStatus.CLOSED] === 3, 'CLOSED = 3');

console.log('\n=== Declaration File Validation ===\n');

// Verify .d.ts files exist for all modules
const dtsFiles = [
  'dist/index.d.ts',
  'dist/enums/index.d.ts',
  'dist/interfaces/index.d.ts',
  'dist/constants/index.d.ts',
];
for (const f of dtsFiles) {
  const fullPath = resolve(__dirname, '..', f);
  try {
    readFileSync(fullPath, 'utf-8');
    assert(true, `${f} exists`);
  } catch {
    assert(false, `${f} exists`);
  }
}

// Verify interfaces in .d.ts
const interfacesDts = readFileSync(resolve(__dirname, '..', 'dist/interfaces/index.d.ts'), 'utf-8');
const interfaceNames = ['IUser', 'ITenant', 'ITeamMember', 'ITeam', 'ITask', 'IDocument', 'IApproval', 'IComment', 'INotification', 'IMilestone', 'IMessage', 'IResourceRepo', 'IResourceItem', 'IAuditLog'];
for (const name of interfaceNames) {
  assert(interfacesDts.includes(`export interface ${name}`), `Interface ${name} is declared in .d.ts`);
}
assert(interfaceNames.length === 14, 'All 14 interfaces are declared');

// Verify enums in .d.ts
const enumsDts = readFileSync(resolve(__dirname, '..', 'dist/enums/index.d.ts'), 'utf-8');
for (const name of enumNames) {
  assert(enumsDts.includes(`export declare enum ${name}`), `Enum ${name} is declared in .d.ts`);
}
assert(enumNames.length === 9, 'All 9 enums are declared');

// Verify constants in .d.ts
const constsDts = readFileSync(resolve(__dirname, '..', 'dist/constants/index.d.ts'), 'utf-8');
assert(constsDts.includes('ROLE_HIERARCHY'), 'ROLE_HIERARCHY declared in .d.ts');
assert(constsDts.includes('PERMISSION_MATRIX'), 'PERMISSION_MATRIX declared in .d.ts');
assert(constsDts.includes('VALID_STATUS_TRANSITIONS'), 'VALID_STATUS_TRANSITIONS declared in .d.ts');
assert(constsDts.includes('STATUS_ORDER'), 'STATUS_ORDER declared in .d.ts');

// Verify barrel re-export
const indexDts = readFileSync(resolve(__dirname, '..', 'dist/index.d.ts'), 'utf-8');
assert(indexDts.includes("export * from './enums'"), 'Barrel re-exports ./enums');
assert(indexDts.includes("export * from './interfaces'"), 'Barrel re-exports ./interfaces');
assert(indexDts.includes("export * from './constants'"), 'Barrel re-exports ./constants');

console.log('\n=== Global Top-level Exports ===\n');

const allTopExports = Object.keys(shared);
const expectedExports = [
  ...enumNames,
  'ROLE_HIERARCHY', 'PERMISSION_MATRIX', 'VALID_STATUS_TRANSITIONS', 'STATUS_ORDER',
];
for (const name of expectedExports) {
  assert(allTopExports.includes(name), `${name} is exported from barrel index`);
}

// Count total top-level exports (9 enums + 4 constants = 13)
assert(allTopExports.length >= 13, `At least 13 barrel exports (got ${allTopExports.length})`);

console.log('\n=================================');
console.log(`Total: ${passed + failed} assertions`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('=================================\n');

process.exit(failed > 0 ? 1 : 0);
