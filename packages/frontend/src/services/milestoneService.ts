import { get, post } from './api';
import type { IMilestone } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

export function getMilestones(
  teamId: string,
  page?: number,
  limit?: number,
): Promise<PaginatedResponse<IMilestone>> {
  const params: Record<string, string | number> = { teamId };
  if (page !== undefined) params.page = page;
  if (limit !== undefined) params.limit = limit;
  return get<PaginatedResponse<IMilestone>>('/milestones', { params });
}

export function createMilestone(data: {
  name: string;
  description?: string;
  dueDate?: Date;
  teamId: string;
}): Promise<IMilestone> {
  return post<IMilestone>('/milestones', {
    name: data.name,
    description: data.description,
    dueDate: data.dueDate?.toISOString(),
    teamId: data.teamId,
  });
}
