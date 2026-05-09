import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IUser, ITenant, Role } from '@saas/shared-types';

export interface AuthState {
  user: IUser | null;
  tenant: ITenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: Role | null;
}

export interface AuthActions {
  setAuth: (
    user: IUser,
    tenant: ITenant | null,
    accessToken: string,
    refreshToken: string,
    role?: Role
  ) => void;
  setUser: (user: IUser, role?: Role) => void;
  setTenant: (tenant: ITenant) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

const initialState: AuthState = {
  user: null,
  tenant: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  role: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setAuth: (user, tenant, accessToken, refreshToken, role) =>
        set({
          user,
          tenant,
          accessToken,
          refreshToken,
          role: role ?? null,
          isAuthenticated: true,
          isLoading: false,
        }),

      setUser: (user, role) =>
        set((state) => ({
          user,
          role: role === undefined ? state.role : role ?? null,
        })),

      setTenant: (tenant) =>
        set({ tenant }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({
          ...initialState,
          isLoading: false,
        }),

      setLoading: (isLoading) =>
        set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
);
