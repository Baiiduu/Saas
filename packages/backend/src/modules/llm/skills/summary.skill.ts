import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { BaseSkill, SkillRegistry } from './skill.registry';
import { MCPToolRegistry } from '../mcp/mcp.tool-registry';
import {
  SkillDefinition,
  SkillExecutionRequest,
  SkillExecutionResult,
  MCPToolExecutionRequest,
} from '../mcp/mcp.protocol';

/**
 * SummarySkill — generates a summary of a task or project state.
 *
 * Tool chain:
 *   1. "task.get" — fetch the task detail
 *   2. "task.list" — fetch sub-tasks / related tasks
 *   3. "comment.list" — fetch comments for context
 *
 * The skill combines these into a natural-language summary.
 */
@Injectable()
export class SummarySkill extends BaseSkill {
  private readonly logger = new Logger(SummarySkill.name);

  readonly definition: SkillDefinition = {
    id: 'summary',
    name: 'Task Summary',
    description: 'Generate a natural-language summary of a task including its status, assignees, comments, and subtasks.',
    requiredPermission: 'task:read',
    toolChain: ['task.get', 'task.list', 'comment.list'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const { taskId } = request.args as { taskId?: string };

    if (!taskId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required argument: taskId',
        steps: [],
      };
    }

    // Step 1: Fetch task detail
    const taskResult = await toolRegistry.execute({
      toolId: 'task.get',
      args: { taskId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId: request.teamId,
    });
    steps.push({
      toolId: 'task.get',
      success: taskResult.success,
      result: taskResult.data,
      error: taskResult.error,
    });

    if (!taskResult.success) {
      return { skillId: request.skillId, success: false, error: taskResult.error, steps };
    }

    const task = taskResult.data as Record<string, unknown>;

    // Step 2: Fetch related tasks
    const relatedResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: { parentTaskId: taskId, limit: 10 },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId: request.teamId,
    });
    steps.push({
      toolId: 'task.list',
      success: relatedResult.success,
      result: relatedResult.data,
      error: relatedResult.error,
    });

    // Step 3: Fetch comments
    const commentResult = await toolRegistry.execute({
      toolId: 'comment.list',
      args: { resourceType: 'task', resourceId: taskId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId: request.teamId,
    });
    steps.push({
      toolId: 'comment.list',
      success: commentResult.success,
      result: commentResult.data,
      error: commentResult.error,
    });

    // Build the summary text
    const title = (task.title as string) || 'Untitled';
    const status = (task.status as string) || 'unknown';
    const comments = commentResult.success
      ? (commentResult.data as Array<Record<string, unknown>>) ?? []
      : [];
    const related = relatedResult.success
      ? (relatedResult.data as { items?: Array<unknown> })?.items ?? []
      : [];

    const summary = [
      `## Summary: ${title}`,
      `**Status:** ${status}`,
      `**Sub-tasks:** ${related.length}`,
      `**Comments:** ${comments.length}`,
      '',
      comments.length > 0
        ? '### Recent Comments:\n' +
          comments
            .slice(0, 5)
            .map((c) => `- ${(c.content as string)?.substring(0, 100)}`)
            .join('\n')
        : 'No comments yet.',
    ].join('\n');

    this.logger.log(`Summary generated for task ${taskId}`);

    return {
      skillId: request.skillId,
      success: true,
      data: { summary, task, relatedTasksCount: related.length, commentsCount: comments.length },
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
