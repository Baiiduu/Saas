import { create } from 'zustand';
import type { ITenant, ITeam } from '@saas/shared-types';

export interface WorkspaceState {
  currentTenant: ITenant | null;
  currentTeam: ITeam | null;
  tenants: ITenant[];
  teams: ITeam[];
}

export interface WorkspaceActions {
  setCurrentTenant: (tenant: ITenant) => void;
  setCurrentTeam: (team: ITeam) => void;
  setTenants: (tenants: ITenant[]) => void;
  setTeams: (teams: ITeam[]) => void;
  clearWorkspace: () => void;
}

const initialState: WorkspaceState = {
  currentTenant: null,
  currentTeam: null,
  tenants: [],
  teams: [],
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  (set) => ({
    ...initialState,

      setCurrentTenant: (tenant) => {
        localStorage.setItem('current_tenant_id', tenant.id);
        set({ currentTenant: tenant });
      },

    setCurrentTeam: (team) =>
      set({ currentTeam: team }),

    setTenants: (tenants) =>
      set({ tenants }),

    setTeams: (teams) =>
      set({ teams }),

      clearWorkspace: () => {
        localStorage.removeItem('current_tenant_id');
        set({ ...initialState });
      },
  })
);
