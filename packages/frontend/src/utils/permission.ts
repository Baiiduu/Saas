import {
  Role,
  ROLE_HIERARCHY,
  PERMISSION_MATRIX,
} from '@saas/shared-types';

/**
 * Check if a given role can perform a specific operation.
 * Uses ROLE_HIERARCHY and PERMISSION_MATRIX from shared-types.
 */
export function canPerformOperation(
  userRole: Role,
  operation: string
): boolean {
  const minRole = PERMISSION_MATRIX[operation];
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
  return PERMISSION_MATRIX[operation];
}
