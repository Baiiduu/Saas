import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * TenantGuard — reads X-Tenant-Id header and attaches it to the request.
 *
 * ⚠ PROTOTYPE IMPLEMENTATION:
 * - Parses the X-Tenant-Id header and sets `request.tenantId`.
 * - Does NOT validate tenant existence (will be implemented in T-24).
 * - If no header is present, tenantId remains undefined (multi-tenant
 *   isolation will be enforced in V1).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    if (tenantId) {
      (request as any).tenantId = tenantId;
    }

    // Prototype: always allow, tenant enforcement comes in T-24
    return true;
  }
}
