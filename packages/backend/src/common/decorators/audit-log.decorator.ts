import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

/**
 * AuditLog decorator — marks a route handler for audit logging.
 *
 * ⚠ SKELETON IMPLEMENTATION (V0):
 * The decorator is defined and sets metadata, but no audit
 * interceptor is active yet. Full audit logging will be
 * implemented in V1 (AsyncLocalStorage + audit queue).
 *
 * @example
 * ```ts
 * &#64;AuditLog({ resourceType: 'task', action: 'delete' })
 * &#64;Delete('tasks/:id')
 * deleteTask() { ... }
 * ```
 */
export interface AuditLogOptions {
  resourceType: string;
  action: string;
  details?: boolean; // whether to capture request body as details (default false)
}

export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);
