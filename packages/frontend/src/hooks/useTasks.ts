import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as taskService from '@/services/taskService';
import type { GetTasksParams } from '@/services/taskService';
import type { TaskStatus, Priority } from '@saas/shared-types';

export function useTasks(params?: GetTasksParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => taskService.getTasks(params),
    enabled: !!params,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => taskService.getTask(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      priority?: Priority;
      assigneeId?: string;
      dueDate?: string;
      teamId: string;
      tags?: string[];
    }) => taskService.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        title: string;
        description: string;
        status: TaskStatus;
        priority: Priority;
        assigneeId: string;
        dueDate: string;
        tags: string[];
      }>;
    }) => taskService.updateTask(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.id] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAssignTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      taskService.assignTask(id, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useBoard(teamId: string | undefined) {
  return useQuery({
    queryKey: ['board', teamId],
    queryFn: () => taskService.getTasks({ teamId, limit: 100 }),
    enabled: !!teamId,
  });
}

export function useUpdateTaskPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      sortOrder,
      status,
    }: {
      id: string;
      sortOrder: number;
      status: TaskStatus;
    }) => taskService.updateTaskPosition(id, sortOrder, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
