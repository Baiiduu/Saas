import { SetMetadata } from '@nestjs/common';
import { Role } from '@saas/shared-types';

export const RBAC_KEY = 'rbac';

/**
 * RBAC decorator — sets required roles for a route handler.
 *
 * The decorator stores required role metadata which is consumed by the
 * RbacGuard. In non-strict mode the guard performs a fast-path hierarchy
 * check; controllers may also call `RbacService.requireRole()` for an
 * explicit async check that covers tenant and team memberships.
 *
 * @example
 * ```ts
 * &#64;RBAC(Role.ADMIN, Role.OWNER)
 * &#64;Delete('users/:id')
 * deleteUser() { ... }
 * ```
 */
export const RBAC = (...roles: Role[]) => SetMetadata(RBAC_KEY, roles);
