import React from 'react';
import { usePermission } from '@/hooks/usePermission';

export interface PermissionProps {
  /** Operation(s) to check. Single string or array of strings. */
  op: string | string[];
  /** If 'all' (default), ALL operations must pass. If 'any', ANY operation passes. */
  match?: 'all' | 'any';
  /** Fallback content to render when the user lacks permission. */
  fallback?: React.ReactNode;
  /** Children to render when permission is granted. */
  children: React.ReactNode;
}

/**
 * Permission component — declarative RBAC guard.
 *
 * Usage:
 *   <Permission op="task:create">
 *     <Button>Create Task</Button>
 *   </Permission>
 *
 *   <Permission op={['task:edit', 'task:delete']} match="any">
 *     <Button>Manage</Button>
 *   </Permission>
 *
 *   <Permission op="admin:panel" fallback={<Text>Access denied</Text>}>
 *     <AdminPanel />
 *   </Permission>
 */
const Permission: React.FC<PermissionProps> = ({
  op,
  match = 'all',
  fallback = null,
  children,
}) => {
  const { canAll, canAny } = usePermission();

  const operations = Array.isArray(op) ? op : [op];
  const hasPermission =
    match === 'any' ? canAny(operations) : canAll(operations);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default Permission;
