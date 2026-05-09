import { get, post } from './api';
import type { IMilestone } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

type BackendMilestone = IMilestone & {
  status: string;
};

function normalizeMilestoneStatus(milestone: BackendMilestone): IMilestone {
  const status =
    milestone.status === 'completed'
      ? 'completed'
      : milestone.status === 'overdue' ||
          (milestone.dueDate &&
            new Date(milestone.dueDate) < new Date() &&
            milestone.status !== 'completed')
        ? 'overdue'
        : 'active';

  return {
    ...milestone,
    status,
  };
}

export function getMilestones(
  teamId: string,
  page?: number,
  limit?: number,
): Promise<PaginatedResponse<IMilestone>> {
  const params: Record<string, string | number> = { teamId };
  if (page !== undefined) params.page = page;
  if (limit !== undefined) params.limit = limit;
  return get<PaginatedResponse<BackendMilestone>>('/milestones', { params }).then(
    (response) => ({
      ...response,
      items: (response.items ?? []).map(normalizeMilestoneStatus),
    }),
  );
}

export function createMilestone(data: {
  name: string;
  description?: string;
  dueDate: { toISOString: () => string };
  teamId: string;
}): Promise<IMilestone> {
  return post<IMilestone>('/milestones', {
    name: data.name,
    description: data.description,
    dueDate: data.dueDate?.toISOString(),
    teamId: data.teamId,
  }).then(normalizeMilestoneStatus);
}
