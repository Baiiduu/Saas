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
 * WeeklyReportSkill — generates a weekly report for a team.
 *
 * Tool chain:
 *   1. "task.list" — fetch tasks completed in the week
 *   2. "dashboard.teamStats" — fetch team stats
 *   3. "milestone.list" — fetch milestone progress
 *
 * The skill consolidates this data into a structured weekly report.
 */
@Injectable()
export class WeeklyReportSkill extends BaseSkill {
  private readonly logger = new Logger(WeeklyReportSkill.name);

  readonly definition: SkillDefinition = {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Generate a structured weekly report for a team including task completion, milestones, and team stats.',
    requiredPermission: 'report:read',
    toolChain: ['task.list', 'dashboard.teamStats', 'milestone.list'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const { teamId } = request.args as { teamId?: string };

    if (!teamId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required argument: teamId',
        steps: [],
      };
    }

    // Calculate date range for "this week"
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Step 1: Fetch completed tasks this week
    const tasksResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: {
        teamId,
        status: 'DONE',
        updatedAtFrom: startOfWeek.toISOString(),
        updatedAtTo: endOfWeek.toISOString(),
        limit: 100,
      },
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

    // Step 2: Fetch team stats
    const statsResult = await toolRegistry.execute({
      toolId: 'dashboard.teamStats',
      args: { teamId },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
    });
    steps.push({
      toolId: 'dashboard.teamStats',
      success: statsResult.success,
      result: statsResult.data,
      error: statsResult.error,
    });

    // Step 3: Fetch milestones
    const milestonesResult = await toolRegistry.execute({
      toolId: 'milestone.list',
      args: { teamId, limit: 20 },
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

    // Build the report
    const completedTasks = tasksResult.success
      ? (tasksResult.data as { items?: Array<unknown> })?.items ?? []
      : [];
    const stats = statsResult.success ? (statsResult.data as Record<string, unknown>) : null;
    const milestones = milestonesResult.success
      ? (milestonesResult.data as { items?: Array<unknown> })?.items ?? []
      : [];

    const report = [
      '# Weekly Report',
      `**Period:** ${startOfWeek.toLocaleDateString()} — ${endOfWeek.toLocaleDateString()}`,
      '',
      '## Summary',
      `- Tasks completed this week: ${completedTasks.length}`,
      `- Total tasks: ${(stats?.totalTasks as string) ?? 'N/A'}`,
      `- Completion rate: ${(stats?.completionRate as string) ?? 'N/A'}%`,
      `- Overdue tasks: ${(stats?.overdueTasks as string) ?? 'N/A'}`,
      `- Active milestones: ${milestones.length}`,
      '',
      completedTasks.length > 0
        ? '## Completed Tasks\n' +
          (completedTasks as Array<Record<string, unknown>>)
            .slice(0, 20)
            .map((t: Record<string, unknown>) => `- ${t.title as string}`)
            .join('\n')
        : 'No tasks were completed this week.',
    ].join('\n');

    this.logger.log(`Weekly report generated for team ${teamId}`);

    return {
      skillId: request.skillId,
      success: true,
      data: {
        report,
        period: { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() },
        completedTasks: completedTasks.length,
        stats,
        milestones: milestones.length,
      },
      steps,
    };
  }
}

/**
 * Factory to register the WeeklyReportSkill.
 */
export function registerWeeklyReportSkill(
  registry: SkillRegistry,
  skill: WeeklyReportSkill,
): void {
  registry.registerSkill(skill);
}
