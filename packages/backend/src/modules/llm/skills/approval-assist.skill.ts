import { Injectable, Logger } from '@nestjs/common';
import { MCPToolRegistry } from '../mcp/mcp.tool-registry';
import { SkillDefinition, SkillExecutionRequest, SkillExecutionResult } from '../mcp/mcp.protocol';
import { BaseSkill, SkillRegistry } from './skill.registry';

@Injectable()
export class ApprovalAssistSkill extends BaseSkill {
  private readonly logger = new Logger(ApprovalAssistSkill.name);

  readonly definition: SkillDefinition = {
    id: 'approval-assist',
    name: 'Approval Assist',
    description: 'Read a reference approval and prepare a new approval submission.',
    requiredPermission: 'llm.create',
    toolChain: ['approval.get', 'approval.create'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const teamId = (request.args.teamId as string | undefined) ?? request.teamId;
    const approvalId = request.args.approvalId as string | undefined;
    const templateId = request.args.templateId as string | undefined;
    const title = (request.args.title as string | undefined) ?? 'AI 发起审批';
    const formData = (request.args.formData as Record<string, unknown> | undefined) ?? {};

    if (!teamId || !templateId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required arguments: teamId and templateId',
        status: 'failed',
        steps: [],
      };
    }

    let referenceApproval: unknown;

    if (approvalId) {
      const getResult = await toolRegistry.execute({
        toolId: 'approval.get',
        args: { approvalId },
        userId: request.userId,
        tenantId: request.tenantId,
        teamId,
        sessionId: request.sessionId,
        skillRunId: request.skillRunId,
      });

      steps.push({
        toolId: 'approval.get',
        success: getResult.success,
        status: getResult.status,
        result: getResult.data,
        error: getResult.error,
        toolCallId: getResult.toolCallId,
        requiresConfirmation: getResult.requiresConfirmation,
        confirmationToken: getResult.confirmationToken,
      });

      if (getResult.status === 'pending_confirmation') {
        return {
          skillId: request.skillId,
          success: false,
          status: 'pending_confirmation',
          requiresConfirmation: true,
          confirmationToken: getResult.confirmationToken,
          steps,
        };
      }

      if (!getResult.success) {
        return {
          skillId: request.skillId,
          success: false,
          error: getResult.error ?? 'Failed to read reference approval',
          status: 'failed',
          steps,
        };
      }

      referenceApproval = getResult.data;
    }

    const createResult = await toolRegistry.execute({
      toolId: 'approval.create',
      args: {
        title,
        templateId,
        teamId,
        formData: {
          ...formData,
          referenceApprovalId: approvalId ?? null,
        },
      },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });

    steps.push({
      toolId: 'approval.create',
      success: createResult.success,
      status: createResult.status,
      result: createResult.data,
      error: createResult.error,
      toolCallId: createResult.toolCallId,
      requiresConfirmation: createResult.requiresConfirmation,
      confirmationToken: createResult.confirmationToken,
    });

    if (createResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: createResult.confirmationToken,
        steps,
      };
    }

    if (!createResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error: createResult.error ?? 'Failed to create approval',
        status: 'failed',
        steps,
      };
    }

    this.logger.log(`Approval assist prepared a new approval for team ${teamId}`);

    return {
      skillId: request.skillId,
      success: true,
      status: 'completed',
      data: {
        referenceApproval,
        approval: createResult.data,
      },
      steps,
    };
  }
}

export function registerApprovalAssistSkill(
  registry: SkillRegistry,
  skill: ApprovalAssistSkill,
): void {
  registry.registerSkill(skill);
}
