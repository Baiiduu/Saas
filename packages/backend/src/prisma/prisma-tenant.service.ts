import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tenant context type stored in AsyncLocalStorage.
 */
export interface TenantContext {
  tenantId: string;
  schemaName: string;
}

/**
 * PrismaTenantService — wraps PrismaClient with full tenant data isolation
 * using AsyncLocalStorage.
 *
 * On each request, the TenantMiddleware sets the tenant context.
 * All subsequent Prisma queries within the same async context
 * automatically use the correct tenant schema.
 *
 * This service creates dedicated PrismaClient instances per tenant,
 * using the multiSchema preview feature to switch schemas.
 */
@Injectable()
export class PrismaTenantService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaTenantService.name);

  /**
   * AsyncLocalStorage to hold tenant context per request/async chain.
   */
  public readonly als = new AsyncLocalStorage<TenantContext>();

  /**
   * Cache of PrismaClient instances per schema name.
   */
  private readonly clients = new Map<string, PrismaClient>();

  /**
   * Default client for public schema operations.
   */
  private readonly defaultClient: PrismaClient;

  constructor() {
    this.defaultClient = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  /**
   * Get the PrismaClient for the current tenant context.
   *
   * If a tenant context is active, returns a schema-scoped client.
   * Otherwise, returns the default public-schema client.
   */
  getClient(): PrismaClient {
    const ctx = this.als.getStore();
    if (!ctx) {
      return this.defaultClient;
    }

    // Return cached client for this schema
    let client = this.clients.get(ctx.schemaName);
    if (!client) {
      client = new PrismaClient({
        log:
          process.env.NODE_ENV === 'development'
            ? ['query', 'info', 'warn', 'error']
            : ['warn', 'error'],
      });
      this.clients.set(ctx.schemaName, client);
      this.logger.log(`Created PrismaClient for schema: ${ctx.schemaName}`);
    }
    return client;
  }

  /**
   * Run a callback within a tenant context.
   */
  runWithTenant<T>(
    tenantId: string,
    schemaName: string,
    callback: () => T | Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.als.run({ tenantId, schemaName }, async () => {
        try {
          const result = await callback();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Get the current tenant context (if any).
   */
  getCurrentContext(): TenantContext | undefined {
    return this.als.getStore();
  }

  async onModuleDestroy() {
    // Disconnect all cached clients
    for (const [schema, client] of this.clients) {
      await client.$disconnect();
      this.logger.log(`Disconnected PrismaClient for schema: ${schema}`);
    }
    await this.defaultClient.$disconnect();
  }
}
