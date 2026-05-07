import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the current tenant ID from the request.
 * The tenant ID is set by TenantMiddleware / TenantGuard.
 *
 * @example
 * ```ts
 * &#64;Get('members')
 * getMembers(@CurrentTenant() tenantId: string) { ... }
 * ```
 */

// Internal factory — exported for unit tests
export function getCurrentTenant(_data: unknown, ctx: ExecutionContext): string | undefined {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantId;
}

export const CurrentTenant = createParamDecorator(getCurrentTenant);
