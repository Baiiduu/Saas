import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import * as authService from '@/services/authService';
import type { IUser } from '@saas/shared-types';
import type { LoginRequest } from '@/types';

// Re-export the store for direct access
export { useAuthStore };

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: (response) => {
      // Store tokens in localStorage
      localStorage.setItem('auth_token', response.accessToken);
      localStorage.setItem('auth_refresh_token', response.refreshToken);

      // Update auth store
      setAuth(
        response.user,
        response.tenant ?? null,
        response.accessToken,
        response.refreshToken,
        response.role
      );

      // Invalidate any cached queries
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      displayName: string;
      phone?: string;
    }) => authService.register(data),
  });
}

export function useActivate() {
  return useMutation({
    mutationFn: (data: { email: string; code: string }) => authService.activate(data),
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Clear auth store
      logout();

      // Clear localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('current_tenant_id');
      localStorage.removeItem('auth-storage');

      // Clear all query caches
      queryClient.clear();

      // Navigate to login
      navigate('/auth/login');
    },
  });
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authService.getProfile(),
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
}
