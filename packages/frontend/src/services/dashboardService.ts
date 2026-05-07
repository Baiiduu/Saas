import { get } from './api';

export interface DashboardUserStats {
  totalTasks: number;
  completionRate: number;
  pendingCount: number;
  overdueCount: number;
}

export interface DashboardTeamStats {
  totalTasks: number;
  completionRate: number;
  overdueTasks: number;
  activeMembers: number;
  totalMilestones: number;
  milestoneCompletionRate: number;
  tasksByStatus: Record<string, number>;
}

export interface DashboardEnterpriseOverview {
  totalTasks: number;
  completionRate: number;
  overdueTasks: number;
  activeMembers: number;
  totalTeams: number;
  totalMilestones: number;
  milestoneCompletionRate: number;
}

export function getUserStats(): Promise<DashboardUserStats> {
  return get<DashboardUserStats>('/dashboard/user');
}

export function getTeamStats(teamId: string): Promise<DashboardTeamStats> {
  return get<DashboardTeamStats>(`/dashboard/team/${teamId}`);
}

export function getEnterpriseOverview(): Promise<DashboardEnterpriseOverview> {
  return get<DashboardEnterpriseOverview>('/dashboard/enterprise');
}
