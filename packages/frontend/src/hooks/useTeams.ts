import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTeams,
  createJoinRequest,
  getJoinRequests,
  processJoinRequest,
  acceptInvitation,
  type TeamListItem,
  type JoinRequestRecord,
  type InvitationAcceptResult,
} from '@/services/teamService';

/**
 * Hook to fetch the list of teams visible to the current user in a tenant.
 */
export function useTeamsList(tenantId?: string) {
  return useQuery({
    queryKey: ['teams-list', tenantId],
    queryFn: () => getTeams(tenantId!),
    enabled: !!tenantId,
  });
}

/**
 * Hook to create a join request for a team.
 */
export function useCreateJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, message }: { teamId: string; message?: string }) =>
      createJoinRequest(teamId, message),
    onSuccess: (_data, variables) => {
      // Invalidate the teams list to reflect any UI changes
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
    },
  });
}

/**
 * Hook to fetch join requests for a team (admin only).
 */
export function useTeamJoinRequests(teamId?: string, enabled?: boolean) {
  return useQuery({
    queryKey: ['join-requests', teamId],
    queryFn: () => getJoinRequests(teamId!),
    enabled: !!teamId && (enabled ?? true),
  });
}

/**
 * Hook to approve or reject a join request.
 */
export function useProcessJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      requestId,
      action,
    }: {
      teamId: string;
      requestId: string;
      action: 'APPROVED' | 'REJECTED';
    }) => processJoinRequest(teamId, requestId, action),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['join-requests', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-members', variables.teamId] });
    },
  });
}

/**
 * Hook to accept an invitation by token.
 */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
  });
}
