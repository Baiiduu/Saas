import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { get } from '@/services/api';
import {
  canPerformOperation,
  getAllowedOperations,
  normalizePermission,
} from '@/utils/permission';
import type { Role } from '@saas/shared-types';

export interface PermissionCheck {
  can: (operation: string) => boolean;
  canAll: (operations: string[]) => boolean;
  canAny: (operations: string[]) => boolean;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  allowedOperations: string[];
}

/**
 * usePermission - RBAC permission checking hook.
 *
 * Returns an object with helper methods for checking if the current user
 * can perform operations based on their role and the permission matrix.
 *
 * Usage:
 *   const { can, canAll, canAny, role } = usePermission();
 *   if (can('task.create')) { ... }
 *   if (canAny(['task.create', 'task.update'])) { ... }
 *   if (canAll(['task.read', 'comment.create'])) { ... }
 */
export function usePermission(): PermissionCheck {
  const { teamId: routeTeamId } = useParams<{ teamId?: string }>();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentTenant = useWorkspaceStore((state) => state.currentTenant);
  const currentTeam = useWorkspaceStore((state) => state.currentTeam);

  const effectiveTeamId = routeTeamId || currentTeam?.id;

  const permissionQuery = useQuery({
    queryKey: ['rbac-permissions', user?.id, currentTenant?.id, effectiveTeamId],
    queryFn: () =>
      get<{ userId: string; permissions: Record<string, boolean> }>(
        `/rbac/permissions/${user!.id}`,
        {
          params: effectiveTeamId ? { teamId: effectiveTeamId } : undefined,
        }
      ),
    enabled: isAuthenticated && !!user?.id && !!currentTenant?.id,
    staleTime: 30_000,
    retry: 1,
  });

  const can = (operation: string): boolean => {
    if (!isAuthenticated || !role) {
      return false;
    }

    const normalizedOperation = normalizePermission(operation);
    const resolvedPermissions = permissionQuery.data?.permissions;

    if (resolvedPermissions) {
      return Boolean(
        resolvedPermissions[normalizedOperation] ?? resolvedPermissions[operation]
      );
    }

    return canPerformOperation(role as Role, operation);
  };

  const canAll = (operations: string[]): boolean => {
    return operations.every(can);
  };

  const canAny = (operations: string[]): boolean => {
    return operations.some(can);
  };

  const allowedOperations =
    permissionQuery.data?.permissions
      ? Object.entries(permissionQuery.data.permissions)
          .filter(([, allowed]) => allowed)
          .map(([operation]) => operation)
      : isAuthenticated && role
        ? getAllowedOperations(role as Role)
        : [];

  return {
    can,
    canAll,
    canAny,
    role: role as Role | null,
    isAuthenticated,
    isLoading: permissionQuery.isLoading,
    allowedOperations,
  };
}

/**
 * Legacy single-operation hook.
 * Kept for backward compatibility. Prefer usePermission() for new code.
 */
export function useHasPermission(operation: string): boolean {
  return usePermission().can(operation);
}

/**
 * Hook to guard route access by permission.
 * Returns true if the user can perform ALL of the required operations.
 */
export function usePermissionGuard(requiredOperations: string[]): {
  hasAccess: boolean;
  isLoading: boolean;
} {
  const { canAll, isLoading } = usePermission();
  return {
    hasAccess: canAll(requiredOperations),
    isLoading,
  };
}
