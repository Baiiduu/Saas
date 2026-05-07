import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TenantProvisionService handles the provisioning of tenant database schemas.
 * Each tenant gets an isolated PostgreSQL schema (t_<id>) for data isolation.
 */
@Injectable()
export class TenantProvisionService {
  private readonly logger = new Logger(TenantProvisionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new PostgreSQL schema for a tenant.
   * @param schemaName The schema name (e.g., "t_abc123")
   */
  async provisionSchema(schemaName: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
    );
    this.logger.log(`Schema "${schemaName}" provisioned`);
  }

  /**
   * Drop a tenant schema (used during tenant deletion/unsubscribe).
   * @param schemaName The schema name to drop
   */
  async deprovisionSchema(schemaName: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
    this.logger.log(`Schema "${schemaName}" deprovisioned`);
  }

  /**
   * Check if a tenant schema exists.
   * @param schemaName The schema name to check
   */
  async schemaExists(schemaName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '${schemaName}') as exists`,
    );
    return result[0]?.exists ?? false;
  }
}
