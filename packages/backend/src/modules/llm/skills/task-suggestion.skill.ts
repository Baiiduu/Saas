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
 * TaskSuggestionSkill — suggests tasks based on context.
 *
 * Tool chain:
 *   1. "task.list" — fetch current user's tasks
 *   2. "dashboard.userStats" — fetch user stats
 *   3. "milestone.list" — fetch active milestones for context
 *
 * The skill generates task suggestions based on workload and priorities.
 */
@Injectable()
export class TaskSuggestionSkill extends BaseSkill {
  private readonly logger = new Logger(TaskSuggestionSkill.name);

  readonly definition: SkillDefinition = {
    id: 'task-suggestion',
    name: 'Task Suggestions',
    description: 'Analyze current workload and suggest prioritised tasks or actions.',
    requiredPermission: 'task:read',
    toolChain: ['task.list', 'dashboard.userStats', 'milestone.list'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const { teamId } = request.args as { teamId?: string };

    // Step 1: Fetch current user's assigned tasks
    const tasksResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: { assigneeId: request.userId, status: 'IN_PROGRESS', limit: 50 },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
    });
    steps.push({
      toolId: 'task.list',
      success: tasksResult.success,
      result: tasksResult.data,
      error: tasksResult.error,
    });

    // Step 2: Fetch user dashboard stats
    const statsResult = await toolRegistry.execute({
      toolId: 'dashboard.userStats',
      args: { userId: request.userId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
    });
    steps.push({
      toolId: 'dashboard.userStats',
      success: statsResult.success,
      result: statsResult.data,
      error: statsResult.error,
    });

    // Step 3: Fetch team milestones for context
    const milestonesResult = await toolRegistry.execute({
      toolId: 'milestone.list',
      args: { teamId, limit: 10 },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
    });
    steps.push({
      toolId: 'milestone.list',
      success: milestonesResult.success,
      result: milestonesResult.data,
      error: milestonesResult.error,
    });

    // Build suggestions
    const tasks = tasksResult.success
      ? (tasksResult.data as { items?: Array<Record<string, unknown>> })?.items ?? []
      : [];
    const stats = statsResult.success ? (statsResult.data as Record<string, unknown>) : null;
    const milestones = milestonesResult.success
      ? (milestonesResult.data as { items?: Array<Record<string, unknown>> })?.items ?? []
      : [];

    const overdueCount = (stats?.overdueCount as number) ?? 0;
    const pendingCount = (stats?.pendingCount as number) ?? 0;
    const suggestions: string[] = [];

    if (overdueCount > 0) {
      suggestions.push(`You have ${overdueCount} overdue task(s). Consider prioritising them first.`);
    }

    if (pendingCount > 5) {
      suggestions.push(`You have ${pendingCount} pending tasks. Consider breaking them down or delegating.`);
    }

    if (tasks.length === 0 && pendingCount === 0) {
      suggestions.push('You have no active tasks. Check the milestone backlog for new work items.');
    }

    if (milestones.length > 0) {
      const upcomingMilestones = milestones.filter(
        (m: Record<string, unknown>) => m.status === 'pending',
      );
      if (upcomingMilestones.length > 0) {
        suggestions.push(
          `Upcoming milestones: ${upcomingMilestones.map((m: Record<string, unknown>) => m.name as string).join(', ')}`,
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
