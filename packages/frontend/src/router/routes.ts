/**
 * Route path constants for the application.
 * All route paths should be defined here to ensure consistency.
 */
export const ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ACTIVATE: '/auth/activate',
    RESET_PASSWORD: '/auth/reset-password',
  },
  TENANT: {
    SELECT: '/',
    CREATE: '/create-tenant',
  },
  ORG: {
    INDEX: '/org',
    ROOT: '/org/:orgId',
    TEAMS: '/org/:orgId/teams',
    DASHBOARD: '/org/:orgId',
    TEAM: '/org/:orgId/team/:teamId',
    SETTINGS: '/org/:orgId/settings',
    NOTIFICATIONS: '/org/:orgId/notifications',
    USER_PROFILE: '/org/:orgId/user/profile',
    USER_STATS: '/org/:orgId/user/stats',
    AUDIT: '/org/:orgId/audit',
  },
  LLM: {
    CHAT: '/org/:orgId/llm/chat',
  },
  INVITATION: {
    ACCEPT: '/invitations/:token/accept',
  },
} as const;

/**
 * Helper to build a concrete org route path.
 */
export function orgPath(orgId: string): string {
  return `/org/${orgId}`;
}

/**
 * Helper to build a concrete team route path.
 */
export function teamPath(orgId: string, teamId: string): string {
  return `/org/${orgId}/team/${teamId}`;
}

/**
 * Helper to build a concrete team sub-route path.
 */
export function teamSubPath(orgId: string, teamId: string, sub: string): string {
  return `/org/${orgId}/team/${teamId}/${sub}`;
}

/**
 * Helper to build a concrete invitation accept URL.
 */
export function invitationAcceptPath(token: string): string {
  return `/invitations/${token}/accept`;
}
