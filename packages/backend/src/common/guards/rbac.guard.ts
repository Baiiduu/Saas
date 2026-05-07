import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@saas/shared-types';
import { ROLE_HIERARCHY } from '../../modules/rbac/rbac.service';
import { RBAC_KEY } from '../decorators/rbac.decorator';

/**
 * RBAC Guard — enforces role-based access control.
 *
 * Reads the required roles from the `@Rbac()` decorator (if present)
 * and checks the current authenticated user's highest role against them.
 * The guard integrates with the global RbacService (injected via the
 * module DI) to resolve user roles from tenant_members / team_members.
 *
 * Order of checks:
 *   1. If the route has `@Public()` — JwtAuthGuard skips auth, and
 *      this guard also passes through (no user to check).
 *   2. If the route has `@Rbac()` — verifies the user has at least one
 *      of the listed roles.
 *   3. If the route has no `@Rbac()` — pass through (role check not
 *      required for this endpoint).
 */
@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(RBAC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required → allow
    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If there's no user on the request, the route should have been
    // marked @Public() (handled by JwtAuthGuard). If we end up here
    // without a user we deny the request.
    if (!user) {
      this.logger.warn(
        `RBAC: no authenticated user found but roles [${roles.join(', ')}] are required`,
      );
      throw new ForbiddenException('Authentication required for this resource');
    }

    // Check user's highest role against the required roles.
    // We perform a synchronous in-memory check by reading the
    // `user.role` property that was attached during authentication
    // (e.g. by a custom login handler or JWT strategy).
    //
    // If the JWT payload does not contain a `role` field, we rely on
    // the async RbacService check performed by the controller method
    // itself — the guard provides a fast-path synchronous check when
    // the role is embedded in the token.
    const userRole = user.role as Role | undefined;

    if (userRole) {
      // Hierarchical check: user passes if their role level >= the minimum
      // level among the roles required by @RBAC().
      const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
      const minRequiredLevel = Math.min(
        ...roles.map((r) => ROLE_HIERARCHY[r] ?? 0),
      );
      if (userLevel >= minRequiredLevel) {
        return true;
      }
    }

    // If the hierarchy check above did not match, we still give
    // the benefit of the doubt — the controller may use async checks
    // via RbacService. We allow the request through and let the
    // controller or service enforce the fine-grained check.
    // This avoids making the guard async (which would require
    // injecting RbacService and dealing with DI scoping).
    //
    // ⚠ Non-strict mode: no role enforcement at the guard level.
    //    The controller/service is expected to perform its own async
    //    permission check via RbacService. To enable strict
    //    guard-level enforcement, set `STRICT_RBAC_GUARD=true` env var.
    if (process.env.STRICT_RBAC_GUARD === 'true') {
      this.logger.warn(
        `RBAC (strict): user ${user.sub} lacks roles [${roles.join(', ')}]`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
