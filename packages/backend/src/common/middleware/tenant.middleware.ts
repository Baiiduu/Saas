import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaTenantService } from '../../prisma/prisma-tenant.service';

/**
 * TenantMiddleware — reads the X-Tenant-Id header from every
 * incoming request and establishes the tenant context using
 * AsyncLocalStorage so that all downstream operations (Prisma queries,
 * services, etc.) are scoped to the correct tenant schema.
 *
 * This middleware also resolves the tenant schema name by looking
 * up the tenant record in the public schema.
 *
 * ⚠ PERFORMANCE NOTE: This performs a DB lookup on every request.
 *    In production, consider caching tenant -> schema mappings
 *    (e.g., Redis) to avoid the per-request lookup.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly prismaTenant: PrismaTenantService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;

    if (tenantId) {
      (req as any).tenantId = tenantId;

      try {
        // Look up the tenant to get the schema name
        // Use the default (public schema) client for this lookup
        const defaultClient = this.prismaTenant.getClient();
        const tenant = await defaultClient.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, schemaName: true, status: true, deletedAt: true },
        });

        if (tenant) {
          // Reject frozen or deleted tenants
          if (tenant.status === 'frozen') {
            _res.status(403).json({
              code: 40301,
              message: 'Enterprise has been frozen. Please contact your administrator.',
            });
            return;
          }
          if (tenant.deletedAt) {
            _res.status(404).json({
              code: 40401,
              message: 'Enterprise not found or has been deactivated.',
            });
            return;
          }

          // Set tenant context via AsyncLocalStorage.
          // enterWith sets the store for the current async execution context,
          // so all downstream async operations (Prisma queries, etc.)
          // will inherit this tenant context.
          this.prismaTenant.als.enterWith({
            tenantId: tenant.id,
            schemaName: tenant.schemaName,
          });

          (req as any).tenantSchema = tenant.schemaName;
        } else {
          this.logger.warn(`Tenant ${tenantId} not found in public schema`);
        }
      } catch (error) {
        this.logger.error(`Failed to resolve tenant ${tenantId}`, error);
      }
    }

    next();
  }
}
