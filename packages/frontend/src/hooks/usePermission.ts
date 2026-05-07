import { useAuthStore } from '@/stores/authStore';
import { canPerformOperation, getAllowedOperations } from '@/utils/permission';
import type { Role } from '@saas/shared-types';

export interface PermissionCheck {
  can: (operation: string) => boolean;
  canAll: (operations: string[]) => boolean;
  canAny: (operations: string[]) => boolean;
  role: Role | null;
  isAuthenticated: boolean;
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
 *   if (canAll(['task.view', 'comment.create'])) { ... }
 */
export function usePermission(): PermissionCheck {
  const role = useAuthStore((state) => state.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const can = (operation: string): boolean => {
    if (!isAuthenticated || !role) {
      return false;
    }
    return canPerformOperation(role as Role, operation);
  };

  const canAll = (operations: string[]): boolean => {
    return operations.every(can);
  };

  const canAny = (operations: string[]): boolean => {
    return operations.some(can);
  };

  const allowedOperations = isAuthenticated && role ? getAllowedOperations(role as Role) : [];

  return {
    can,
    canAll,
    canAny,
    role: role as Role | null,
    isAuthenticated,
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
  const { canAll } = usePermission();
  return {
    hasAccess: canAll(requiredOperations),
    isLoading: false,
  };
}
