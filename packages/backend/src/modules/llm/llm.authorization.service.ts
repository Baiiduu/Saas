import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { MCPToolDefinition, MCPToolExecutionRequest } from './mcp/mcp.protocol';

interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  teamId?: string;
  resourceId?: string;
}

@Injectable()
export class LlmAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async canAccessPermission(
    permission: string,
    userId: string,
    tenantId: string,
    teamId?: string,
  ): Promise<boolean> {
    return this.rbacService.canAccessPermission(permission, userId, tenantId, { teamId });
  }

  async assertPermission(
    permission: string,
    userId: string,
    tenantId: string,
    teamId?: string,
  ): Promise<void> {
    await this.rbacService.assertPermission(permission, userId, tenantId, { teamId });
  }

  async canAccessToolDefinition(
    definition: MCPToolDefinition,
    userId: string,
    tenantId: string,
    teamId?: string,
  ): Promise<boolean> {
    return this.canAccessPermission(definition.requiredPermission, userId, tenantId, teamId);
  }

  async authorizeToolExecution(
    definition: MCPToolDefinition,
    request: MCPToolExecutionRequest,
  ): Promise<AuthorizationDecision> {
    const resourceId = this.extractResourceId(definition.resourceType, request.args);
    const targetTeamId = await this.resolveTargetTeamId(definition.resourceType, request, resourceId);

    try {
      await this.rbacService.assertPermission(
        definition.requiredPermission,
        request.userId,
        request.tenantId,
        {
          teamId: targetTeamId,
          resourceId,
          ownership: this.getOwnershipRule(definition.id),
        },
      );

      return {
        allowed: true,
        teamId: targetTeamId,
        resourceId,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Permission denied',
        teamId: targetTeamId,
        resourceId,
      };
    }
  }

  private getOwnershipRule(
    toolId: string,
  ): 'creator' | 'creator_or_assignee' | undefined {
    if (toolId === 'document.update_content') {
      return 'creator';
    }

    if (toolId === 'task.update') {
      return 'creator_or_assignee';
    }

    return undefined;
  }

  private async resolveTargetTeamId(
    resourceType: string,
    request: MCPToolExecutionRequest,
    resourceId?: string,
  ): Promise<string | undefined> {
    const directTeamId = (request.args.teamId as string | undefined) ?? request.teamId;
    if (directTeamId) {
      return directTeamId;
    }

    if (!resourceId) {
      return undefined;
    }

    if (resourceType === 'task') {
      const task = await this.prisma.task.findUnique({
        where: { id: resourceId },
        select: { teamId: true, deletedAt: true },
      });
      return task && !task.deletedAt ? task.teamId : undefined;
    }

    if (resourceType === 'document') {
      const document = await this.prisma.document.findUnique({
        where: { id: resourceId },
        select: { teamId: true, deletedAt: true },
      });
      return document && !document.deletedAt ? document.teamId : undefined;
    }

    if (resourceType === 'approval') {
      const approval = await this.prisma.approval.findUnique({
        where: { id: resourceId },
        select: { teamId: true, deletedAt: true },
      });
      return approval && !approval.deletedAt ? approval.teamId : undefined;
    }

    if (resourceType === 'milestone') {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: resourceId },
        select: { teamId: true, deletedAt: true },
      });
      return milestone && !milestone.deletedAt ? milestone.teamId : undefined;
    }

    return undefined;
  }

  private extractResourceId(
    resourceType: string,
    args: Record<string, unknown>,
  ): string | undefined {
    const keysByType: Record<string, string[]> = {
      task: ['taskId', 'id'],
      document: ['docId', 'documentId', 'id'],
      approval: ['approvalId', 'id'],
      milestone: ['milestoneId', 'id'],
      member: ['userId', 'memberId'],
    };

    const keys = keysByType[resourceType] ?? ['id'];
    for (const key of keys) {
      const value = args[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }
}
