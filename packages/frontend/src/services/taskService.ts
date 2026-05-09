import { get, post, patch, del } from './api';
import type { ITask, TaskStatus, Priority } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

export interface GetTasksParams {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  teamId?: string;
}

interface BackendTaskAssignee {
  userId: string;
  user?: {
    id: string;
    displayName?: string;
    avatar?: string;
  };
}

interface BackendTaskTag {
  name: string;
}

interface BackendTask extends Omit<ITask, 'assigneeId' | 'tags'> {
  assigneeId?: string;
  assignees?: BackendTaskAssignee[];
  tags?: Array<string | BackendTaskTag>;
  creator?: {
    id: string;
  };
}

interface BackendPaginatedTaskResponse {
  items: BackendTask[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function normalizeTask(task: BackendTask): ITask {
  const firstAssignee = task.assignees?.[0];
  return {
    ...task,
    creatorId: task.creator?.id ?? task.creatorId,
    assigneeId: task.assigneeId ?? firstAssignee?.userId,
    tags: (task.tags ?? []).map((tag) =>
      typeof tag === 'string' ? tag : tag.name
    ),
  };
}

function normalizeTaskList(
  response: BackendPaginatedTaskResponse
): PaginatedResponse<ITask> {
  const pagination = response.pagination;
  return {
    items: (response.items ?? []).map(normalizeTask),
    meta: {
      page: pagination?.page ?? 1,
      pageSize: pagination?.limit ?? response.items?.length ?? 0,
      total: pagination?.total ?? response.items?.length ?? 0,
      totalPages: pagination?.totalPages ?? 1,
    },
  };
}

export function getTasks(
  params?: GetTasksParams
): Promise<PaginatedResponse<ITask>> {
  return get<BackendPaginatedTaskResponse>('/tasks', { params }).then(
    normalizeTaskList
  );
}

export function getTask(id: string): Promise<ITask> {
  return get<BackendTask>(`/tasks/${id}`).then(normalizeTask);
}

export function createTask(data: {
  title: string;
  description?: string;
  priority?: Priority;
  assigneeId?: string;
  dueDate?: string;
  teamId: string;
  tags?: string[];
}): Promise<ITask> {
  return post<BackendTask>('/tasks', {
    title: data.title,
    description: data.description,
    priority: data.priority,
    dueDate: data.dueDate,
    tagNames: data.tags || [],
    assigneeIds: data.assigneeId ? [data.assigneeId] : [],
    teamId: data.teamId,
  }).then(normalizeTask);
}

export function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    assigneeId: string;
    dueDate: string;
    tags: string[];
  }>
): Promise<ITask> {
  const body: Record<string, unknown> = { ...data };
  if ('assigneeId' in data) {
    body.assigneeIds = data.assigneeId ? [data.assigneeId] : [];
    delete body.assigneeId;
  }
  if ('tags' in data) {
    body.tagNames = data.tags || [];
    delete body.tags;
  }
  return patch<BackendTask>(`/tasks/${id}`, body).then(normalizeTask);
}

export function deleteTask(id: string): Promise<void> {
  return del<void>(`/tasks/${id}`);
}

export function assignTask(
  id: string,
  userIds: string[]
): Promise<ITask> {
  return post<BackendTask>(`/tasks/${id}/assignees`, { userIds }).then(
    normalizeTask
  );
}

export function updateTaskPosition(
  id: string,
  sortOrder: number,
  status: TaskStatus
): Promise<void> {
  return patch<void>(`/tasks/${id}/position`, { sortOrder, status });
}
