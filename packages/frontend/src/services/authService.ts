import { post, get, put } from './api';
import type { IUser } from '@saas/shared-types';
import type { LoginRequest, LoginResponse } from '@/types';

export function login(data: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', data);
}

export function register(data: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}): Promise<void> {
  return post<void>('/auth/register', data);
}

export function activate(data: { email: string; code: string }): Promise<void> {
  return post<void>('/auth/activate', data);
}

export function logout(): Promise<void> {
  return post<void>('/auth/logout');
}

export function refreshToken(
  refreshTokenValue: string
): Promise<{ accessToken: string }> {
  return post<{ accessToken: string }>('/auth/refresh', {
    refreshToken: refreshTokenValue,
  });
}

export function getProfile(): Promise<IUser> {
  return get<IUser>('/user/profile');
}

export function updateProfile(
  data: Partial<Pick<IUser, 'displayName'> & { avatar: string }>
): Promise<IUser> {
  return put<IUser>('/user/profile', data);
}

export function githubOAuth(code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  return post<{ accessToken: string; refreshToken: string; user: any }>('/auth/oauth/github', null, { params: { code } });
}

export function googleOAuth(idToken: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  return post<{ accessToken: string; refreshToken: string; user: any }>('/auth/oauth/google', null, { params: { idToken } });
}
