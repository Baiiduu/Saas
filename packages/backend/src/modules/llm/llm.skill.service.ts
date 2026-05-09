import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SkillRegistry } from './skills/skill.registry';
import { SkillExecutionRequest, SkillExecutionResult } from './mcp/mcp.protocol';
import { LlmAuditService } from './llm.audit.service';
import { LlmAuthorizationService } from './llm.authorization.service';

@Injectable()
export class LlmSkillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skillRegistry: SkillRegistry,
    private readonly auditService: LlmAuditService,
    private readonly authorizationService: LlmAuthorizationService,
  ) {}

  listSkills() {
    return this.skillRegistry.listSkills();
  }

  async listSkillsForContext(
    userId: string,
    tenantId: string,
    teamId?: string,
  ) {
    const skills = this.listSkills();
    const results = await Promise.all(
      skills.map(async (skill) => {
        const [resourceType = 'llm', operation = 'read'] = skill.requiredPermission
          .replace(':', '.')
          .split('.');

        const allowed = await this.authorizationService.canAccessToolDefinition(
          {
            id: `skill.${skill.id}`,
            name: skill.name,
            description: skill.description,
            parameters: [],
            requiredPermission: `${resourceType}.${operation}`,
            resourceType,
            actionType: operation === 'read' ? 'read' : 'write',
            riskLevel: 'low',
          },
          userId,
          tenantId,
          teamId,
        );

        return { skill, allowed };
      }),
    );

    return results.filter((item) => item.allowed).map((item) => item.skill);
  }

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const skill = this.skillRegistry.getSkill(request.skillId);
    if (!skill) {
      return {
        skillId: request.skillId,
        success: false,
        error: `Skill "${request.skillId}" not found`,
        status: 'failed',
        steps: [],
      };
    }

    const availableSkills = await this.listSkillsForContext(
      request.userId,
      request.tenantId,
      request.teamId,
    );

    if (!availableSkills.find((item) => item.id === request.skillId)) {
      await this.auditService.append({
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: request.teamId,
        sessionId: request.sessionId,
        eventType: 'permission.denied',
        action: `skill.${request.skillId}`,
        status: 'denied',
        detail: {
          reason: `Permission ${skill.requiredPermission} denied`,
        },
      });

      return {
        skillId: request.skillId,
        success: false,
        error: `Permission ${skill.requiredPermission} denied`,
        status: 'failed',
        steps: [],
      };
    }

    const run = await this.prisma.aiSkillRun.create({
      data: {
        sessionId: request.sessionId ?? null,
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: request.teamId ?? null,
        skillId: skill.id,
        skillName: skill.name,
        status: 'RUNNING',
        args: request.args as any,
      },
    });

    const result = await this.skillRegistry.execute({
      ...request,
      skillRunId: run.id,
    });

    const status =
      result.status === 'pending_confirmation'
        ? 'WAITING_CONFIRMATION'
        : result.success
          ? 'COMPLETED'
          : 'FAILED';

    await this.prisma.aiSkillRun.update({
      where: { id: run.id },
      data: {
        status,
        result: result.data as any,
        error: result.error ?? null,
        steps: result.steps as any,
      },
    });

    await this.auditService.append({
      userId: request.userId,
      tenantId: request.tenantId,
      teamId: request.teamId,
      sessionId: request.sessionId,
      skillRunId: run.id,
      eventType: 'skill.run',
      action: request.skillId,
      status: result.status ?? (result.success ? 'completed' : 'failed'),
      detail: {
        args: request.args,
        steps: result.steps.map((step) => ({
          toolId: step.toolId,
          status: step.status ?? (step.success ? 'completed' : 'failed'),
          toolCallId: step.toolCallId,
        })),
      },
    });

    return {
      ...result,
      skillRunId: run.id,
    };
  }
}
