import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '@/services/dashboardService';

export function useUserStats() {
  return useQuery({
    queryKey: ['dashboard', 'user'],
    queryFn: () => dashboardService.getUserStats(),
  });
}

export function useTeamStats(teamId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'team', teamId],
    queryFn: () => dashboardService.getTeamStats(teamId!),
    enabled: !!teamId,
  });
}

export function useEnterpriseOverview() {
  return useQuery({
    queryKey: ['dashboard', 'enterprise'],
    queryFn: () => dashboardService.getEnterpriseOverview(),
  });
}
