import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TENANT_OPTIONAL_KEY } from '../decorators/tenant-optional.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isTenantOptional = this.reflector.getAllAndOverride<boolean>(TENANT_OPTIONAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & {
      tenantId?: string;
      tenantSchema?: string;
      user?: { sub?: string; role?: string };
      currentTenantRole?: string;
    }>();

    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    if (tenantId) {
      request.tenantId = tenantId;
    }

    if (!request.user?.sub) {
      return true;
    }

    if (!request.tenantId) {
      if (isTenantOptional) {
        return true;
      }
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status === 'frozen') {
      throw new ForbiddenException('Enterprise has been frozen');
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: request.user.sub,
          tenantId: request.tenantId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of the current tenant');
    }

    request.currentTenantRole = membership.role as string;
    request.user.role = membership.role as string;
    return true;
  }
}
