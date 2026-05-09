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
 * TaskSuggestionSkill — suggests next actions based on tasks and team members.
 */
@Injectable()
export class TaskSuggestionSkill extends BaseSkill {
  private readonly logger = new Logger(TaskSuggestionSkill.name);

  readonly definition: SkillDefinition = {
    id: 'task-suggestion',
    name: 'Task Suggestions',
    description: 'Analyse current workload and suggest prioritised next actions.',
    requiredPermission: 'llm.read',
    toolChain: ['task.list', 'team.member.list'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const teamId = (request.args.teamId as string | undefined) ?? request.teamId;

    if (!teamId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required argument: teamId',
        status: 'failed',
        steps: [],
      };
    }

    const tasksResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: {
        assigneeId: request.userId,
        teamId,
        limit: 50,
      },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'task.list',
      success: tasksResult.success,
      status: tasksResult.status,
      result: tasksResult.data,
      error: tasksResult.error,
      toolCallId: tasksResult.toolCallId,
      requiresConfirmation: tasksResult.requiresConfirmation,
      confirmationToken: tasksResult.confirmationToken,
    });

    if (tasksResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: tasksResult.confirmationToken,
        steps,
      };
    }

    const membersResult = await toolRegistry.execute({
      toolId: 'team.member.list',
      args: { teamId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'team.member.list',
      success: membersResult.success,
      status: membersResult.status,
      result: membersResult.data,
      error: membersResult.error,
      toolCallId: membersResult.toolCallId,
      requiresConfirmation: membersResult.requiresConfirmation,
      confirmationToken: membersResult.confirmationToken,
    });

    if (membersResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: membersResult.confirmationToken,
        steps,
      };
    }

    if (!tasksResult.success || !membersResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error: tasksResult.error ?? membersResult.error ?? 'Task suggestion skill failed',
        status: 'failed',
        steps,
      };
    }

    const tasks = tasksResult.success
      ? (tasksResult.data as { items?: Array<Record<string, unknown>> })?.items ?? []
      : [];
    const members = membersResult.success
      ? (membersResult.data as Array<Record<string, unknown>>) ?? []
      : [];

    const overdueCount = tasks.filter(
      (task) =>
        task.dueDate &&
        ['DONE', 'CLOSED'].indexOf(String(task.status ?? '')) === -1 &&
        new Date(String(task.dueDate)) < new Date(),
    ).length;
    const pendingCount = tasks.filter((task) =>
      ['TODO', 'IN_PROGRESS'].includes(String(task.status ?? '')),
    ).length;
    const suggestions: string[] = [];

    if (overdueCount > 0) {
      suggestions.push(`You have ${overdueCount} overdue task(s). Consider prioritising them first.`);
    }

    if (pendingCount > 5) {
      suggestions.push(`You have ${pendingCount} pending tasks. Consider breaking them down or delegating.`);
    }

    if (tasks.length === 0 && pendingCount === 0) {
      suggestions.push('You have no active tasks. Coordinate with your team lead for the next priority item.');
    }

    if (members.length > 0) {
      const otherMembers = members.filter(
        (member) => (member.user as Record<string, unknown> | undefined)?.id !== request.userId,
      );
      if (otherMembers.length > 0) {
        suggestions.push(
          `Potential collaborators: ${otherMembers
            .slice(0, 3)
            .map((member) => String((member.user as Record<string, unknown>)?.displayName ?? '未命名成员'))
            .join(', ')}`,
        );
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('You are on track. Keep up the good work!');
    }

    const result = {
      suggestions,
      stats: {
        overdueCount,
        pendingCount,
        inProgressCount: tasks.length,
      },
    };

    this.logger.log(`Task suggestions generated for user ${request.userId}`);

    return {
      skillId: request.skillId,
      success: true,
      status: 'completed',
      data: result,
      steps,
    };
  }
}

/**
 * Factory to register the TaskSuggestionSkill.
 */
export function registerTaskSuggestionSkill(
  registry: SkillRegistry,
  skill: TaskSuggestionSkill,
): void {
  registry.registerSkill(skill);
}
