import { get, post, patch } from './api';

export interface TeamListItem {
  id: string;
  name: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  _count: { members: number };
}

export interface JoinRequestRecord {
  id: string;
  userId: string;
  displayName?: string;
  email?: string;
  reason?: string;
  createdAt: string;
}

export interface InvitationAcceptResult {
  teamId: string;
  teamName: string;
}

/**
 * Fetch all teams in the current tenant.
 * Backend: GET /api/v1/teams?tenantId=...
 */
export function getTeams(tenantId: string): Promise<TeamListItem[]> {
  return get<TeamListItem[]>('/teams', { params: { tenantId } });
}

/**
 * Create a join request for a team.
 * Backend: POST /api/v1/teams/:id/join-requests
 */
export function createJoinRequest(
  teamId: string,
  message?: string
): Promise<{ id: string }> {
  return post<{ id: string }>(`/teams/${teamId}/join-requests`, {
    message: message || undefined,
  });
}

/**
 * Get pending join requests for a team (admin only).
 * Backend: GET /api/v1/teams/:id/join-requests
 */
export function getJoinRequests(teamId: string): Promise<JoinRequestRecord[]> {
  return get<JoinRequestRecord[]>(`/teams/${teamId}/join-requests`);
}

/**
 * Approve or reject a join request.
 * Backend: PATCH /api/v1/teams/:id/join-requests/:requestId
 */
export function processJoinRequest(
  teamId: string,
  requestId: string,
  action: 'APPROVED' | 'REJECTED'
): Promise<void> {
  return patch<void>(`/teams/${teamId}/join-requests/${requestId}`, { action });
}

/**
 * Accept an invitation by token.
 * Backend: POST /api/v1/invitations/:token/accept
 */
export function acceptInvitation(token: string): Promise<InvitationAcceptResult> {
  return post<InvitationAcceptResult>(`/invitations/${token}/accept`);
}
