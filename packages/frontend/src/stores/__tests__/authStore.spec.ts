/**
 * @jest-environment node
 */

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { useAuthStore } from '../authStore';
import type { IUser, ITenant } from '@saas/shared-types';
import { Role } from '@saas/shared-types';

const mockUser: IUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockTenant: ITenant = {
  id: 'tenant-1',
  name: 'Test Tenant',
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset the store to initial state
    useAuthStore.setState({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      role: null,
    });
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.tenant).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.role).toBeNull();
  });

  it('should set auth via setAuth', () => {
    const { setAuth } = useAuthStore.getState();
    setAuth(mockUser, mockTenant, 'access-token-123', 'refresh-token-456', Role.ADMIN);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.tenant).toEqual(mockTenant);
    expect(state.accessToken).toBe('access-token-123');
    expect(state.refreshToken).toBe('refresh-token-456');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.role).toBe(Role.ADMIN);
  });

  it('should set auth without role (role defaults to null)', () => {
    const { setAuth } = useAuthStore.getState();
    setAuth(mockUser, mockTenant, 'token', 'refresh');

    const state = useAuthStore.getState();
    expect(state.role).toBeNull();
    expect(state.isAuthenticated).toBe(true);
  });

  it('should update user via setUser', () => {
    useAuthStore.getState().setAuth(mockUser, mockTenant, 'token', 'refresh', Role.MEMBER);

    const updatedUser: IUser = { ...mockUser, displayName: 'Updated Name' };
    useAuthStore.getState().setUser(updatedUser, Role.LEADER);

    const state = useAuthStore.getState();
    expect(state.user?.displayName).toBe('Updated Name');
    expect(state.role).toBe(Role.LEADER);
  });

  it('should update user and reset role to null when role omitted', () => {
    useAuthStore.getState().setAuth(mockUser, mockTenant, 'token', 'refresh', Role.MEMBER);
    useAuthStore.getState().setUser({ ...mockUser, displayName: 'New Name' });

    const state = useAuthStore.getState();
    expect(state.user?.displayName).toBe('New Name');
    expect(state.role).toBeNull(); // setUser resets role to null when not provided
  });

  it('should update tenant via setTenant', () => {
    useAuthStore.getState().setAuth(mockUser, mockTenant, 'token', 'refresh');

    const newTenant: ITenant = { ...mockTenant, name: 'New Tenant' };
    useAuthStore.getState().setTenant(newTenant);

    const state = useAuthStore.getState();
    expect(state.tenant?.name).toBe('New Tenant');
  });

  it('should update tokens via setTokens', () => {
    useAuthStore.getState().setAuth(mockUser, mockTenant, 'old-token', 'old-refresh');
    useAuthStore.getState().setTokens('new-access', 'new-refresh');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
  });

  it('should reset state on logout', () => {
    useAuthStore.getState().setAuth(mockUser, mockTenant, 'token', 'refresh', Role.ADMIN);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.tenant).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.role).toBeNull();
  });

  it('should set loading state via setLoading', () => {
    expect(useAuthStore.getState().isLoading).toBe(false);
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
