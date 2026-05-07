import type { IUser, ITenant, IPaginationMeta, Role } from '@saas/shared-types';

// Re-export shared types for convenience
export type { IUser, ITenant, IPaginationMeta, Role };

// Frontend-specific API response wrapper
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: IPaginationMeta;
}

// Auth-related frontend types
export interface LoginRequest {
  email: string;
  password: string;
  tenantCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
  tenant?: ITenant | null;
  role?: Role;
}

export interface AuthState {
  user: IUser | null;
  tenant: ITenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Navigation and routing types
export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  children?: RouteConfig[];
  permissions?: string[];
}

// Sidebar menu item type
export interface SidebarMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  children?: SidebarMenuItem[];
  path?: string;
  permissions?: string[];
}

// Common component prop types
export interface PageContainerProps {
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
}
