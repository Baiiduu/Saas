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
  'tenant.read': Role.READER,
  'tenant.update': Role.ADMIN,
  'tenant.delete': Role.OWNER,
  'tenant.invite': Role.ADMIN,

  // Team
  'team.create': Role.ADMIN,
  'team.read': Role.READER,
  'team.update': Role.LEADER,
  'team.delete': Role.OWNER,

  // Team members
  'member.create': Role.LEADER,
  'member.read': Role.READER,
  'member.update': Role.LEADER,
  'member.delete': Role.LEADER,
  'member.manage': Role.LEADER,

  // Task
  'task.create': Role.MEMBER,
  'task.read': Role.READER,
  'task.update': Role.MEMBER,
  'task.delete': Role.LEADER,
  'task.assign': Role.LEADER,

  // Document
  'document.create': Role.MEMBER,
  'document.read': Role.READER,
  'document.update': Role.MEMBER,
  'document.delete': Role.LEADER,
  'document.share': Role.MEMBER,

  // Approval
  'approval.create': Role.MEMBER,
  'approval.read': Role.READER,
  'approval.approve': Role.LEADER,
  'approval.manage': Role.LEADER,

  // Comment
  'comment.create': Role.MEMBER,
  'comment.delete': Role.MEMBER,

  // Notification
  'notification.read': Role.MEMBER,
  'notification.manage': Role.LEADER,

  // Milestone
  'milestone.create': Role.LEADER,
  'milestone.read': Role.MEMBER,
  'milestone.update': Role.LEADER,
  'milestone.delete': Role.ADMIN,

  // Message
  'message.create': Role.MEMBER,
  'message.read': Role.MEMBER,

  // Resource
  'resource.create': Role.LEADER,
  'resource.read': Role.MEMBER,
  'resource.update': Role.LEADER,
  'resource.delete': Role.ADMIN,

  // Resource graph canvas
  'graph.create': Role.LEADER,
  'graph.read': Role.MEMBER,
  'graph.update': Role.LEADER,
  'graph.delete': Role.ADMIN,

  // Audit
  'audit.read': Role.ADMIN,

  // Dashboard
  'dashboard.read': Role.MEMBER,

  // LLM / AI
  'llm.read': Role.MEMBER,
  'llm.create': Role.MEMBER,

  // Legacy aliases kept for UI compatibility
  'task.view': Role.READER,
  'document.view': Role.READER,
  'approval.view': Role.READER,
  'notification.view': Role.MEMBER,
  'message.view': Role.MEMBER,
  'message.send': Role.MEMBER,
  'milestone.view': Role.MEMBER,
  'resource.view': Role.MEMBER,
  'audit.view': Role.ADMIN,
  'dashboard.view': Role.MEMBER,
  'team.add_member': Role.LEADER,
  'team.remove_member': Role.LEADER,
  'team.update_member_role': Role.LEADER,
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
