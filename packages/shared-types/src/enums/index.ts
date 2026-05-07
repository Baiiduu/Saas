export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CLOSED = 'CLOSED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  LEADER = 'LEADER',
  MEMBER = 'MEMBER',
  READER = 'READER',
  GUEST = 'GUEST',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
}

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  COMMENT_MENTION = 'COMMENT_MENTION',
  APPROVAL_NEEDED = 'APPROVAL_NEEDED',
  APPROVAL_RESULT = 'APPROVAL_RESULT',
  DOCUMENT_SHARED = 'DOCUMENT_SHARED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  TEAM_INVITE = 'TEAM_INVITE',
  MILESTONE_DUE = 'MILESTONE_DUE',
}

export enum ResourceType {
  GIT_REPO = 'GIT_REPO',
  S3_BUCKET = 'S3_BUCKET',
  FILE = 'FILE',
}

export enum TeamVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum DocumentType {
  FOLDER = 'FOLDER',
  FILE = 'FILE',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}
