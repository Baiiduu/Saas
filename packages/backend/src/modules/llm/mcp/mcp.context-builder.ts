import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MCPContext } from './mcp.protocol';

/**
 * Builds a rich MCP context from the current tenant/user/team data.
 *
 * This context is injected into LLM prompts so the model can make
 * tenant-aware decisions without needing explicit IDs in every query.
 */
@Injectable()
export class MCPContextBuilder {
  private readonly logger = new Logger(MCPContextBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a context object for MCP tool execution.
   */
  async buildContext(params: {
    userId: string;
    tenantId: string;
    teamId?: string;
  }): Promise<MCPContext> {
    const { userId, tenantId, teamId } = params;

    const context: MCPContext = {
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    };

    // Fetch tenant name
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      if (tenant) {
        context.tenantName = tenant.name;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch tenant ${tenantId}: ${(err as Error).message}`);
    }

    // Fetch user info
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, displayName: true },
      });
      if (user) {
        context.userEmail = user.email;
        context.userDisplayName = user.displayName;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch user ${userId}: ${(err as Error).message}`);
    }

    // Fetch team info + user role within the tenant
    if (teamId) {
      try {
        const team = await this.prisma.team.findUnique({
          where: { id: teamId },
          select: { name: true },
        });
        if (team) {
          context.teamName = team.name;
          context.teamId = teamId;
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch team ${teamId}: ${(err as Error).message}`);
      }
    }

    // Fetch tenant-level role
    try {
      const member = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        select: { role: true },
      });
      if (member) {
        context.role = member.role;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch role for user ${userId}: ${(err as Error).message}`);
    }

    this.logger.debug(`MCP context built for user ${userId} / tenant ${tenantId}`);
    return context;
  }
}
