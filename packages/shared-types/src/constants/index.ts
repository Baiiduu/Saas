import { Role, TaskStatus } from '../enums';

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 6,
  [Role.ADMIN]: 5,
  [Role.LEADER]: 4,
  [Role.MEMBER]: 3,
  [Role.READER]: 2,
  [Role.GUEST]: 1,
};

// Permission matrix: operation -> minimum role level required
export const PERMISSION_MATRIX: Record<string, Role> = {
  // Tenant
  'tenant.update': Role.OWNER,
  'tenant.delete': Role.OWNER,
  'tenant.invite': Role.ADMIN,

  // Team
  'team.create': Role.LEADER,
  'team.update': Role.ADMIN,
  'team.delete': Role.OWNER,
  'team.add_member': Role.LEADER,
  'team.remove_member': Role.ADMIN,
  'team.update_member_role': Role.ADMIN,

  // Task
  'task.create': Role.MEMBER,
  'task.update': Role.MEMBER,
  'task.delete': Role.LEADER,
  'task.assign': Role.LEADER,
  'task.view': Role.READER,

  // Document
  'document.create': Role.MEMBER,
  'document.update': Role.MEMBER,
  'document.delete': Role.LEADER,
  'document.share': Role.MEMBER,
  'document.view': Role.READER,

  // Approval
  'approval.create': Role.MEMBER,
  'approval.approve': Role.LEADER,
  'approval.view': Role.MEMBER,

  // Comment
  'comment.create': Role.MEMBER,
  'comment.delete': Role.MEMBER,

  // Notification
  'notification.view': Role.MEMBER,
  'notification.manage': Role.LEADER,

  // Milestone
  'milestone.create': Role.LEADER,
  'milestone.update': Role.LEADER,
  'milestone.delete': Role.ADMIN,
  'milestone.view': Role.MEMBER,

  // Message
  'message.send': Role.MEMBER,
  'message.view': Role.MEMBER,

  // Resource
  'resource.create': Role.LEADER,
  'resource.update': Role.LEADER,
  'resource.delete': Role.ADMIN,
  'resource.view': Role.MEMBER,

  // Audit
  'audit.view': Role.ADMIN,

  // Dashboard
  'dashboard.view': Role.MEMBER,
};

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.TODO],
  [TaskStatus.DONE]: [TaskStatus.CLOSED, TaskStatus.IN_PROGRESS],
  [TaskStatus.CLOSED]: [TaskStatus.TODO],
};

export const STATUS_ORDER: Record<TaskStatus, number> = {
  [TaskStatus.TODO]: 0,
  [TaskStatus.IN_PROGRESS]: 1,
  [TaskStatus.DONE]: 2,
  [TaskStatus.CLOSED]: 3,
};
