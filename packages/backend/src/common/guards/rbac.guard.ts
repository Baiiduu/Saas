import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@saas/shared-types';
import { RBAC_KEY } from '../decorators/rbac.decorator';
import { RbacService, ROLE_HIERARCHY } from '../../modules/rbac/rbac.service';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[]>(RBAC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string; role?: string };
      tenantId?: string;
      params?: Record<string, string | undefined>;
      query?: Record<string, string | undefined>;
      body?: Record<string, string | undefined>;
    }>();

    const user = request.user;
    if (!user?.sub) {
      this.logger.warn(`RBAC: missing authenticated user for roles [${roles.join(', ')}]`);
      throw new ForbiddenException('Authentication required for this resource');
    }

    const teamId =
      request.params?.teamId ??
      request.query?.teamId ??
      request.body?.teamId;

    const tokenRole = user.role as Role | undefined;
    if (tokenRole) {
      const userLevel = ROLE_HIERARCHY[tokenRole] ?? 0;
      const minRequiredLevel = Math.min(...roles.map((role) => ROLE_HIERARCHY[role] ?? 0));
      if (userLevel >= minRequiredLevel && !request.tenantId) {
        return true;
      }
    }

    if (request.tenantId) {
      const allowed = await this.rbacService.hasTenantRole(
        user.sub,
        request.tenantId,
        roles,
        teamId,
      );

      if (allowed) {
        return true;
      }
    }

    this.logger.warn(`RBAC denied for user ${user.sub}; required roles [${roles.join(', ')}]`);
    throw new ForbiddenException('Insufficient permissions');
  }
}
