import {
  Role,
  ROLE_HIERARCHY,
  PERMISSION_MATRIX,
} from '@saas/shared-types';

const PERMISSION_ALIASES: Record<string, string> = {
  'task.view': 'task.read',
  'document.view': 'document.read',
  'approval.view': 'approval.read',
  'notification.view': 'notification.read',
  'message.view': 'message.read',
  'message.send': 'message.create',
  'resource.view': 'resource.read',
  'milestone.view': 'milestone.read',
  'dashboard.view': 'dashboard.read',
  'audit.view': 'audit.read',
  'team.add_member': 'member.create',
  'team.remove_member': 'member.delete',
  'team.update_member_role': 'member.update',
};

export function normalizePermission(operation: string): string {
  return PERMISSION_ALIASES[operation] ?? operation;
}

/**
 * Check if a given role can perform a specific operation.
 * Uses ROLE_HIERARCHY and PERMISSION_MATRIX from shared-types.
 */
export function canPerformOperation(
  userRole: Role,
  operation: string
): boolean {
  const normalizedOperation = normalizePermission(operation);
  const minRole =
    PERMISSION_MATRIX[normalizedOperation] ?? PERMISSION_MATRIX[operation];
  if (!minRole) {
    // Operation not defined in matrix — deny by default
    return false;
  }

  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[minRole];

  // A user can perform the operation if their role level is >= the required level
  return userLevel >= requiredLevel;
}

/**
 * Return all operations that a given role can perform.
 */
export function getAllowedOperations(role: Role): string[] {
  const userLevel = ROLE_HIERARCHY[role];

  return Object.entries(PERMISSION_MATRIX).reduce<string[]>(
    (allowed, [operation, minRole]) => {
      const requiredLevel = ROLE_HIERARCHY[minRole];
      if (userLevel >= requiredLevel) {
        allowed.push(operation);
      }
      return allowed;
    },
    []
  );
}

/**
 * Return the minimum role needed to perform a given operation.
 * Returns undefined if the operation is not defined in the matrix.
 */
export function getMinimumRoleForOperation(
  operation: string
): Role | undefined {
  const normalizedOperation = normalizePermission(operation);
  return PERMISSION_MATRIX[normalizedOperation] ?? PERMISSION_MATRIX[operation];
}
