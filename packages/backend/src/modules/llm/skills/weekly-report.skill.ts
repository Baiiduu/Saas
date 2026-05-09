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
 */
@Injectable()
export class WeeklyReportSkill extends BaseSkill {
  private readonly logger = new Logger(WeeklyReportSkill.name);

  readonly definition: SkillDefinition = {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Generate a structured weekly report using tasks, milestones, and team members.',
    requiredPermission: 'llm.read',
    toolChain: ['task.list', 'milestone.list', 'team.member.list'],
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

    // Calculate date range for "this week"
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const tasksResult = await toolRegistry.execute({
      toolId: 'task.list',
      args: {
        teamId,
        limit: 100,
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

    const milestonesResult = await toolRegistry.execute({
      toolId: 'milestone.list',
      args: { teamId, limit: 20 },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });
    steps.push({
      toolId: 'milestone.list',
      success: milestonesResult.success,
      status: milestonesResult.status,
      result: milestonesResult.data,
      error: milestonesResult.error,
      toolCallId: milestonesResult.toolCallId,
      requiresConfirmation: milestonesResult.requiresConfirmation,
      confirmationToken: milestonesResult.confirmationToken,
    });

    if (milestonesResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: milestonesResult.confirmationToken,
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

    if (!tasksResult.success || !milestonesResult.success || !membersResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error:
          tasksResult.error ??
          milestonesResult.error ??
          membersResult.error ??
          'Weekly report skill failed',
        status: 'failed',
        steps,
      };
    }

    const completedTasks = tasksResult.success
      ? (tasksResult.data as { items?: Array<unknown> })?.items ?? []
      : [];
    const milestones = milestonesResult.success
      ? (milestonesResult.data as { items?: Array<unknown> })?.items ?? []
      : [];
    const members = membersResult.success
      ? (membersResult.data as Array<Record<string, unknown>>) ?? []
      : [];

    const report = [
      '# Weekly Report',
      `**Period:** ${startOfWeek.toLocaleDateString()} — ${endOfWeek.toLocaleDateString()}`,
      '',
      '## Summary',
      `- Sampled tasks in team: ${completedTasks.length}`,
      `- Active milestones: ${milestones.length}`,
      `- Active members: ${members.length}`,
      '',
      completedTasks.length > 0
        ? '## Task Focus\n' +
          (completedTasks as Array<Record<string, unknown>>)
            .slice(0, 20)
            .map((t: Record<string, unknown>) => `- ${String(t.title ?? '未命名任务')} [${String(t.status ?? 'UNKNOWN')}]`)
            .join('\n')
        : 'No task data available this week.',
    ].join('\n');

    this.logger.log(`Weekly report generated for team ${teamId}`);

    return {
      skillId: request.skillId,
      success: true,
      status: 'completed',
      data: {
        report,
        period: { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() },
        sampledTasks: completedTasks.length,
        members: members.length,
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
