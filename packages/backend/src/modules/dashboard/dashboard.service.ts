import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Simple CSV serialisation helper.
 * Converts an array of objects to a CSV string.
 */
function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get personal statistics for the current user:
   * - totalTasks: total number of tasks assigned to the user
   * - completionRate: percentage of completed tasks (DONE + CLOSED)
   * - pendingCount: number of tasks in TODO or IN_PROGRESS status
   * - overdueCount: number of past-due tasks that are not DONE or CLOSED
   */
  async getUserStats(userId: string) {
    // Total tasks assigned to user
    const totalTasks = await this.prisma.taskAssignee.count({
      where: { userId },
    });

    // Completed tasks (DONE or CLOSED)
    const completedTasks = await this.prisma.taskAssignee.count({
      where: {
        userId,
        task: { status: { in: ['DONE', 'CLOSED'] } },
      },
    });

    // Pending tasks (TODO or IN_PROGRESS)
    const pendingTasks = await this.prisma.taskAssignee.count({
      where: {
        userId,
        task: { status: { in: ['TODO', 'IN_PROGRESS'] } },
      },
    });

    // Overdue tasks (not DONE/CLOSED and past due date)
    const overdueTasks = await this.prisma.taskAssignee.count({
      where: {
        userId,
        task: {
          status: { notIn: ['DONE', 'CLOSED'] },
          dueDate: { lt: new Date() },
        },
      },
    });

    const completionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    this.logger.log(`Dashboard stats queried for user ${userId}`);

    return {
      totalTasks,
      completionRate,
      pendingCount: pendingTasks,
      overdueCount: overdueTasks,
    };
  }

  // ── Enterprise Overview ──────────────────────────────────────

  /**
   * Get enterprise-level overview statistics.
   * Provides aggregate metrics across all teams in the tenant.
   */
  async getEnterpriseOverview() {
    const now = new Date();

    // Total tasks across all teams (non-deleted)
    const totalTasks = await this.prisma.task.count({
      where: { deletedAt: null },
    });

    // Completed tasks
    const completedTasks = await this.prisma.task.count({
      where: { status: { in: ['DONE', 'CLOSED'] }, deletedAt: null },
    });

    // Overdue tasks
    const overdueTasks = await this.prisma.task.count({
      where: {
        status: { notIn: ['DONE', 'CLOSED'] },
        dueDate: { lt: now },
        deletedAt: null,
      },
    });

    // Active members (users with active team memberships)
    const activeMembers = await this.prisma.teamMember.count({
      where: {
        team: { deletedAt: null },
      },
    });

    // Total teams
    const totalTeams = await this.prisma.team.count({
      where: { deletedAt: null },
    });

    // Total milestones
    const totalMilestones = await this.prisma.milestone.count({
      where: { deletedAt: null },
    });

    // Completed milestones
    const completedMilestones = await this.prisma.milestone.count({
      where: { status: 'completed', deletedAt: null },
    });

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const milestoneCompletionRate =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    this.logger.log('Enterprise dashboard overview queried');

    return {
      totalTasks,
      completionRate,
      overdueTasks,
      activeMembers,
      totalTeams,
      totalMilestones,
      milestoneCompletionRate,
    };
  }

  // ── Team-level Stats ───────────────────────────────────────

  /**
   * Get team-level dashboard statistics.
   */
  async getTeamStats(teamId: string) {
    const now = new Date();

    // Total tasks in the team
    const totalTasks = await this.prisma.task.count({
      where: { teamId, deletedAt: null },
    });

    // Tasks by status
    const tasksByStatus = await this.prisma.task.groupBy({
      by: ['status'],
      where: { teamId, deletedAt: null },
      _count: { id: true },
    });

    // Completed tasks
    const completedTasks = await this.prisma.task.count({
      where: {
        teamId,
        status: { in: ['DONE', 'CLOSED'] },
        deletedAt: null,
      },
    });

    // Overdue tasks
    const overdueTasks = await this.prisma.task.count({
      where: {
        teamId,
        status: { notIn: ['DONE', 'CLOSED'] },
        dueDate: { lt: now },
        deletedAt: null,
      },
    });

    // Active members in the team
    const activeMembers = await this.prisma.teamMember.count({
      where: { teamId },
    });

    // Total milestones
    const totalMilestones = await this.prisma.milestone.count({
      where: { teamId, deletedAt: null },
    });

    // Completed milestones
    const completedMilestones = await this.prisma.milestone.count({
      where: { teamId, status: 'completed', deletedAt: null },
    });

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const milestoneCompletionRate =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    this.logger.log(`Team dashboard stats queried for team ${teamId}`);

    return {
      totalTasks,
      completionRate,
      overdueTasks,
      activeMembers,
      totalMilestones,
      milestoneCompletionRate,
      tasksByStatus: tasksByStatus.reduce(
        (acc, cur) => {
          acc[cur.status] = cur._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  // ── Export ───────────────────────────────────────────────────

  /**
   * Export user stats as CSV.
   */
  async exportUserStatsCsv(userId: string): Promise<{ csv: string; filename: string }> {
    const stats = await this.getUserStats(userId);

    const rows = [
      { metric: 'Total Tasks', value: stats.totalTasks },
      { metric: 'Completion Rate (%)', value: stats.completionRate },
      { metric: 'Pending Count', value: stats.pendingCount },
      { metric: 'Overdue Count', value: stats.overdueCount },
    ];

    return {
      csv: toCsv(rows),
      filename: `user-stats-${userId.substring(0, 8)}.csv`,
    };
  }

  /**
   * Export enterprise overview as CSV.
   */
  async exportEnterpriseOverviewCsv(): Promise<{ csv: string; filename: string }> {
    const overview = await this.getEnterpriseOverview();

    const rows = [
      { metric: 'Total Tasks', value: overview.totalTasks },
      { metric: 'Completion Rate (%)', value: overview.completionRate },
      { metric: 'Overdue Tasks', value: overview.overdueTasks },
      { metric: 'Active Members', value: overview.activeMembers },
      { metric: 'Total Teams', value: overview.totalTeams },
      { metric: 'Total Milestones', value: overview.totalMilestones },
      { metric: 'Milestone Completion Rate (%)', value: overview.milestoneCompletionRate },
    ];

    return {
      csv: toCsv(rows),
      filename: 'enterprise-overview.csv',
    };
  }

  /**
   * Export team stats as CSV.
   */
  async exportTeamStatsCsv(teamId: string): Promise<{ csv: string; filename: string }> {
    const stats = await this.getTeamStats(teamId);

    const rows = [
      { metric: 'Total Tasks', value: stats.totalTasks },
      { metric: 'Completion Rate (%)', value: stats.completionRate },
      { metric: 'Overdue Tasks', value: stats.overdueTasks },
      { metric: 'Active Members', value: stats.activeMembers },
      { metric: 'Total Milestones', value: stats.totalMilestones },
      { metric: 'Milestone Completion Rate (%)', value: stats.milestoneCompletionRate },
    ];

    // Add task status breakdown
    for (const [status, count] of Object.entries(stats.tasksByStatus)) {
      rows.push({ metric: `Tasks - ${status}`, value: count as number });
    }

    return {
      csv: toCsv(rows),
      filename: `team-stats-${teamId.substring(0, 8)}.csv`,
    };
  }
}
