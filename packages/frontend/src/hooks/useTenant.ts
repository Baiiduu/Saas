import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/services/api';
import type { ITenant, ITeam, ITeamMember } from '@saas/shared-types';

// Tenant queries
export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => get<ITenant[]>('/tenants'),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; industry?: string; scale?: string }) =>
      post<ITenant>('/tenants', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

// Team queries
export function useTeams(tenantId?: string) {
  return useQuery({
    queryKey: ['teams', tenantId],
    queryFn: () => get<ITeam[]>(`/teams`, { params: { tenantId } }),
    enabled: !!tenantId,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      tenantId: string;
      visibility?: string;
    }) => {
      const { tenantId, ...body } = data;
      return post<ITeam>('/teams', body, { params: { tenantId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// Team member queries
export function useTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const members = await get<Array<ITeamMember & {
        user?: {
          email?: string;
          displayName?: string;
          avatar?: string | null;
        };
      }>>(`/teams/${teamId}/members`);
      return members.map((member) => ({
        ...member,
        email: member.user?.email,
        displayName: member.user?.displayName,
        avatarUrl: member.user?.avatar ?? undefined,
      }));
    },
    enabled: !!teamId,
  });
}
