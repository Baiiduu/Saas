/**
 * @jest-environment node
 */

import { useWorkspaceStore } from '../workspaceStore';
import type { ITenant, ITeam } from '@saas/shared-types';
import { TeamVisibility } from '@saas/shared-types';

const mockTenant: ITenant = {
  id: 'tenant-1',
  name: 'Test Tenant',
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockTeam: ITeam = {
  id: 'team-1',
  name: 'Test Team',
  tenantId: 'tenant-1',
  visibility: TeamVisibility.PUBLIC,
  isArchived: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('workspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      currentTenant: null,
      currentTeam: null,
      tenants: [],
      teams: [],
    });
  });

  it('should initialize with default state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.currentTenant).toBeNull();
    expect(state.currentTeam).toBeNull();
    expect(state.tenants).toEqual([]);
    expect(state.teams).toEqual([]);
  });

  it('should set current tenant', () => {
    useWorkspaceStore.getState().setCurrentTenant(mockTenant);
    expect(useWorkspaceStore.getState().currentTenant).toEqual(mockTenant);
  });

  it('should set current team', () => {
    useWorkspaceStore.getState().setCurrentTeam(mockTeam);
    expect(useWorkspaceStore.getState().currentTeam).toEqual(mockTeam);
  });

  it('should set tenants list', () => {
    const tenants = [mockTenant, { ...mockTenant, id: 'tenant-2', name: 'Tenant 2' }];
    useWorkspaceStore.getState().setTenants(tenants);
    expect(useWorkspaceStore.getState().tenants).toHaveLength(2);
    expect(useWorkspaceStore.getState().tenants[1].name).toBe('Tenant 2');
  });

  it('should set teams list', () => {
    const teams = [mockTeam, { ...mockTeam, id: 'team-2', name: 'Team 2' }];
    useWorkspaceStore.getState().setTeams(teams);
    expect(useWorkspaceStore.getState().teams).toHaveLength(2);
    expect(useWorkspaceStore.getState().teams[1].name).toBe('Team 2');
  });

  it('should clear workspace to initial state', () => {
    useWorkspaceStore.getState().setCurrentTenant(mockTenant);
    useWorkspaceStore.getState().setCurrentTeam(mockTeam);
    useWorkspaceStore.getState().setTenants([mockTenant]);
    useWorkspaceStore.getState().setTeams([mockTeam]);

    useWorkspaceStore.getState().clearWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.currentTenant).toBeNull();
    expect(state.currentTeam).toBeNull();
    expect(state.tenants).toEqual([]);
    expect(state.teams).toEqual([]);
  });
});
