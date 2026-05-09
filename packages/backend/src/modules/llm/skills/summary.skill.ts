import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { BaseSkill, SkillRegistry } from './skill.registry';
import { MCPToolRegistry } from '../mcp/mcp.tool-registry';
import {
  SkillDefinition,
  SkillExecutionRequest,
  SkillExecutionResult,
} from '../mcp/mcp.protocol';

/**
 * SummarySkill — generates a cross-resource summary for the current team context.
 */
@Injectable()
export class SummarySkill extends BaseSkill {
  private readonly logger = new Logger(SummarySkill.name);

  readonly definition: SkillDefinition = {
    id: 'summary',
    name: 'Summary',
    description: 'Summarise task, document, and approval activity for the current team context.',
    requiredPermission: 'llm.read',
    toolChain: ['task.list', 'document.list', 'approval.list'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const teamId = (request.args.teamId as string | undefined) ?? request.teamId;
    const limit = (request.args.limit as number | undefined) ?? 8;

    if (!teamId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required argument: teamId',
        status: 'failed',
        steps: [],
      };
    }

    const taskResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: { teamId, limit },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'task.list',
      success: taskResult.success,
      status: taskResult.status,
      result: taskResult.data,
      error: taskResult.error,
      toolCallId: taskResult.toolCallId,
      requiresConfirmation: taskResult.requiresConfirmation,
      confirmationToken: taskResult.confirmationToken,
    });

    if (taskResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: taskResult.confirmationToken,
        steps,
      };
    }

    const documentResult = await toolRegistry.execute({
      toolId: 'document.list',
      args: { teamId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'document.list',
      success: documentResult.success,
      status: documentResult.status,
      result: documentResult.data,
      error: documentResult.error,
      toolCallId: documentResult.toolCallId,
      requiresConfirmation: documentResult.requiresConfirmation,
      confirmationToken: documentResult.confirmationToken,
    });

    if (documentResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: documentResult.confirmationToken,
        steps,
      };
    }

    const approvalResult = await toolRegistry.execute({
      toolId: 'approval.list',
      args: { teamId, limit },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'approval.list',
      success: approvalResult.success,
      status: approvalResult.status,
      result: approvalResult.data,
      error: approvalResult.error,
      toolCallId: approvalResult.toolCallId,
      requiresConfirmation: approvalResult.requiresConfirmation,
      confirmationToken: approvalResult.confirmationToken,
    });

    if (approvalResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: approvalResult.confirmationToken,
        steps,
      };
    }

    if (!taskResult.success || !documentResult.success || !approvalResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error:
          taskResult.error ??
          documentResult.error ??
          approvalResult.error ??
          'Summary skill failed',
        status: 'failed',
        steps,
      };
    }

    const tasks = ((taskResult.data as { items?: Array<Record<string, unknown>> })?.items ?? []);
    const documents = (documentResult.data as Array<Record<string, unknown>> | undefined) ?? [];
    const approvals = ((approvalResult.data as { items?: Array<Record<string, unknown>> })?.items ?? []);

    const summary = [
      `团队 ${teamId} 当前协作概览：`,
      `- 任务数（本次采样）：${tasks.length}`,
      `- 文档数（当前目录层级）：${documents.length}`,
      `- 审批数（本次采样）：${approvals.length}`,
      '',
      tasks.length > 0
        ? '任务重点：' +
          tasks
            .slice(0, 3)
            .map((task) => `${String(task.title ?? '未命名')}(${String(task.status ?? 'UNKNOWN')})`)
            .join('，')
        : '任务重点：暂无任务数据',
      documents.length > 0
        ? '文档重点：' +
          documents
            .slice(0, 3)
            .map((document) => String(document.name ?? '未命名'))
            .join('，')
        : '文档重点：暂无文档数据',
      approvals.length > 0
        ? '审批重点：' +
          approvals
            .slice(0, 3)
            .map((approval) => String(approval.title ?? approval.id ?? '未命名审批'))
            .join('，')
        : '审批重点：暂无审批数据',
    ].join('\n');

    this.logger.log(`Summary generated for team ${teamId}`);

    return {
      skillId: request.skillId,
      success: true,
      status: 'completed',
      data: {
        summary,
        counts: {
          tasks: tasks.length,
          documents: documents.length,
          approvals: approvals.length,
        },
      },
      steps,
    };
  }
}

/**
 * Factory to register the SummarySkill.
 */
export function registerSummarySkill(
  registry: SkillRegistry,
  skill: SummarySkill,
): void {
  registry.registerSkill(skill);
}
