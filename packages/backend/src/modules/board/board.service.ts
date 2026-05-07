import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class BoardService {
  private readonly logger = new Logger(BoardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get kanban board data for a team.
   * Returns all board columns with tasks grouped under each column by status mapping.
   */
  async getBoard(teamId: string) {
    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });

    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    // Get all columns for the team, ordered by sortOrder
    const columns = await this.prisma.boardColumn.findMany({
      where: { teamId },
      orderBy: { sortOrder: 'asc' },
    });

    // If no columns exist yet, provide default columns
    if (columns.length === 0) {
      return this.getDefaultBoard(teamId);
    }

    // Get tasks grouped under each column's mapped status
    const boardData = await Promise.all(
      columns.map(async (column) => {
        const tasks = await this.prisma.task.findMany({
          where: {
            teamId,
            status: column.statusMapping,
            deletedAt: null,
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
            },
            tags: true,
            creator: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        });

        return {
          column: {
            id: column.id,
            name: column.name,
            statusMapping: column.statusMapping,
            color: column.color,
            sortOrder: column.sortOrder,
          },
          tasks,
        };
      }),
    );

    return boardData;
  }

  /**
   * Get Gantt chart data for a team.
   * Returns tasks with dueDate (end) and createdAt (start proxy) plus dependency info.
   */
  async getGanttData(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });

    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: { teamId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true, avatar: true },
            },
          },
        },
        tags: true,
        creator: {
          select: { id: true, email: true, displayName: true, avatar: true },
        },
        taskRelations: {
          where: { relationType: 'depends_on' },
          select: { relatedTaskId: true },
        },
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      startDate: task.createdAt.toISOString(),
      endDate: task.dueDate ? task.dueDate.toISOString() : null,
      dependencies: task.taskRelations
        .filter((r) => r.relatedTaskId)
        .map((r) => r.relatedTaskId!),
      parentTaskId: task.parentTaskId,
      assignees: task.assignees.map((a) => ({
        id: a.user.id,
        displayName: a.user.displayName,
        avatar: a.user.avatar,
      })),
      tags: task.tags.map((t) => t.name),
      creator: task.creator,
      sortOrder: task.sortOrder,
    }));
  }

  /**
   * Get calendar view data for a team.
   * Returns tasks grouped by dueDate for calendar rendering.
   */
  async getCalendarData(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });

    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        teamId,
        deletedAt: null,
        dueDate: { not: null },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true, avatar: true },
            },
          },
        },
        tags: true,
        creator: {
          select: { id: true, email: true, displayName: true, avatar: true },
        },
      },
    });

    // Group by date string (YYYY-MM-DD)
    const grouped: Record<string, Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate: string;
      assignees: Array<{ id: string; displayName: string; avatar: string | null }>;
      tags: string[];
      creator: { id: string; email: string; displayName: string; avatar: string | null };
      sortOrder: number;
    }>> = {};

    for (const task of tasks) {
      const dateKey = task.dueDate!.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate!.toISOString(),
        assignees: task.assignees.map((a) => ({
          id: a.user.id,
          displayName: a.user.displayName,
          avatar: a.user.avatar,
        })),
        tags: task.tags.map((t) => t.name),
        creator: task.creator,
        sortOrder: task.sortOrder,
      });
    }

    // Convert to sorted array entries
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasksForDate]) => ({
        date,
        tasks: tasksForDate,
      }));
  }

  /**
   * Patch column configuration (add, update, delete, reorder).
   * Creates new columns if no id is provided, updates existing ones,
   * and deletes any columns listed in deletedIds.
   */
  async updateColumnConfig(teamId: string, dto: UpdateColumnDto) {
    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });

    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    // Process columns in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Delete columns marked for deletion
      if (dto.deletedIds && dto.deletedIds.length > 0) {
        await tx.boardColumn.deleteMany({
          where: {
            id: { in: dto.deletedIds },
            teamId,
          },
        });
        this.logger.log(`Deleted ${dto.deletedIds.length} board columns for team ${teamId}`);
      }

      // 2. Upsert columns
      const processed: Array<{
        id: string;
        name: string;
        statusMapping: string;
        color: string | null;
        sortOrder: number;
      }> = [];

      for (const col of dto.columns) {
        if (col.id) {
          // Update existing column
          const updated = await tx.boardColumn.update({
            where: { id: col.id },
            data: {
              name: col.name,
              statusMapping: col.statusMapping,
              color: col.color ?? null,
              sortOrder: col.sortOrder,
            },
          });
          processed.push(updated);
        } else {
          // Create new column
          const created = await tx.boardColumn.create({
            data: {
              teamId,
              name: col.name,
              statusMapping: col.statusMapping,
              color: col.color ?? null,
              sortOrder: col.sortOrder,
            },
          });
          processed.push(created);
        }
      }

      return processed;
    });

    this.logger.log(`Board columns updated for team ${teamId}: ${result.length} columns`);
    return result;
  }

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Provide default board columns with tasks grouped by status.
   */
  private async getDefaultBoard(teamId: string) {
    const defaultColumns = [
      { name: 'To Do', statusMapping: 'TODO' as const, color: '#6B7280', sortOrder: 0 },
      { name: 'In Progress', statusMapping: 'IN_PROGRESS' as const, color: '#3B82F6', sortOrder: 1 },
      { name: 'Done', statusMapping: 'DONE' as const, color: '#10B981', sortOrder: 2 },
      { name: 'Closed', statusMapping: 'CLOSED' as const, color: '#9CA3AF', sortOrder: 3 },
    ];

    const boardData = await Promise.all(
      defaultColumns.map(async (col) => {
        const tasks = await this.prisma.task.findMany({
          where: {
            teamId,
            status: col.statusMapping,
            deletedAt: null,
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
            },
            tags: true,
            creator: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        });

        return {
          column: {
            id: null,
            name: col.name,
            statusMapping: col.statusMapping,
            color: col.color,
            sortOrder: col.sortOrder,
          },
          tasks,
        };
      }),
    );

    return boardData;
  }
}
