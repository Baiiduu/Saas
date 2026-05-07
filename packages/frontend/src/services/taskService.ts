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

export function getTasks(
  params?: GetTasksParams
): Promise<PaginatedResponse<ITask>> {
  return get<PaginatedResponse<ITask>>('/tasks', { params });
}

export function getTask(id: string): Promise<ITask> {
  return get<ITask>(`/tasks/${id}`);
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
  return post<ITask>('/tasks', {
    title: data.title,
    description: data.description,
    priority: data.priority,
    dueDate: data.dueDate,
    tagNames: data.tags || [],
    assigneeIds: data.assigneeId ? [data.assigneeId] : [],
    teamId: data.teamId,
  });
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
  return patch<ITask>(`/tasks/${id}`, body);
}

export function deleteTask(id: string): Promise<void> {
  return del<void>(`/tasks/${id}`);
}

export function assignTask(
  id: string,
  userIds: string[]
): Promise<ITask> {
  return post<ITask>(`/tasks/${id}/assignees`, { userIds });
}

export function updateTaskPosition(
  id: string,
  sortOrder: number,
  status: TaskStatus
): Promise<void> {
  return patch<void>(`/tasks/${id}/position`, { sortOrder, status });
}
