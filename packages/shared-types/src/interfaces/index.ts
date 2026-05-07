import {
  Role,
  TaskStatus,
  Priority,
  ApprovalStatus,
  TeamVisibility,
  DocumentType,
  NotificationType,
  MessageType,
  ResourceType,
  UserStatus,
} from '../enums';

export interface IUser {
  id: string; // UUID
  email: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  status: string; // 'active' | 'pending' | 'disabled'
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface ITenant {
  id: string;
  name: string;
  industry?: string;
  scale?: string; // 'small' | 'medium' | 'large'
  logoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITeamMember {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  joinedAt: string;
}

export interface ITeam {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  visibility: TeamVisibility;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ITask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string;
  creatorId: string;
  teamId: string;
  parentTaskId?: string;
  dueDate?: string;
  sortOrder: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IDocument {
  id: string;
  name: string;
  type: DocumentType;
  parentId?: string;
  teamId: string;
  creatorId: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IApproval {
  id: string;
  title: string;
  templateId: string;
  formData: Record<string, unknown>;
  status: ApprovalStatus;
  creatorId: string;
  teamId: string;
  currentProcessorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IComment {
  id: string;
  content: string;
  resourceType: string; // 'task' | 'document'
  resourceId: string;
  parentId?: string;
  creatorId: string;
  isEdited: boolean;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  userId: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface IMilestone {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  status: string; // 'active' | 'completed' | 'overdue'
  teamId: string;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export interface IMessage {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  teamId: string;
  replyToId?: string;
  createdAt: string;
}

export interface IResourceRepo {
  id: string;
  name: string;
  type: ResourceType;
  config: Record<string, unknown>; // connection config
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IResourceItem {
  id: string;
  repoId: string;
  path: string;
  name: string;
  type: string; // 'file' | 'dir'
  size?: number;
  updatedAt?: string;
}

export interface IPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface IAuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  tenantId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}
