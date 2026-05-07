import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────

  /**
   * Create a milestone with optional linked tasks.
   */
  async create(userId: string, dto: CreateMilestoneDto) {
    const { taskIds, dueDate, ...rest } = dto;

    const milestone = await this.prisma.milestone.create({
      data: {
        ...rest,
        dueDate: new Date(dueDate),
        createdBy: userId,
        tasks: taskIds?.length
          ? {
              create: taskIds.map((taskId) => ({ taskId })),
            }
          : undefined,
      },
      include: {
        tasks: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
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

    // Auto-calculate progress after creation
    const progress = await this.calcProgress(milestone.id);
    if (progress !== milestone.progress) {
      await this.prisma.milestone.update({
        where: { id: milestone.id },
        data: { progress },
      });
      milestone.progress = progress;
    }

    this.logger.log(`Milestone "${milestone.name}" (${milestone.id}) created by user ${userId}`);
    return milestone;
  }

  /**
   * List milestones for a team with pagination.
   */
  async findAll(teamId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.milestone.findMany({
        where: { teamId, deletedAt: null },
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          _count: { select: { tasks: true } },
          creator: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.milestone.count({ where: { teamId, deletedAt: null } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get milestone detail with tasks.
   */
  async findById(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        tasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
              },
            },
          },
        },
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

    if (!milestone || milestone.deletedAt) {
      throw new NotFoundException('Milestone not found');
    }

    return milestone;
  }

  /**
   * Update milestone fields. If taskIds provided, replaces linked tasks.
   */
  async update(
    milestoneId: string,
    data: {
      name?: string;
      description?: string;
      dueDate?: string;
      status?: string;
      progress?: number;
      taskIds?: string[];
    },
  ) {
    const existing = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Milestone not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;

    // Handle task reassignment
    if (data.taskIds !== undefined) {
      await this.prisma.$transaction(async (tx) => {
        await tx.milestoneTask.deleteMany({ where: { milestoneId } });
        if (data.taskIds!.length > 0) {
          await tx.milestoneTask.createMany({
            data: data.taskIds!.map((taskId) => ({
              milestoneId,
              taskId,
            })),
          });
        }
      });
    }

    const milestone = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
      include: {
        tasks: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    // Auto-recalculate progress
    const progress = await this.calcProgress(milestoneId);
    if (progress !== milestone.progress) {
      await this.prisma.milestone.update({
        where: { id: milestone.id },
        data: { progress },
      });
      milestone.progress = progress;
    }

    this.logger.log(`Milestone ${milestoneId} updated`);
    return milestone;
  }

  /**
   * Soft-delete a milestone.
   */
  async delete(milestoneId: string) {
    const existing = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Milestone not found');
    }

    await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Milestone ${milestoneId} soft-deleted`);
  }

  // ── Kanban ──────────────────────────────────────────────────

  /**
   * Get milestones grouped by status for kanban view.
   */
  async getKanban(teamId: string) {
    const milestones = await this.prisma.milestone.findMany({
      where: { teamId, deletedAt: null },
      include: {
        _count: { select: { tasks: true } },
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Group by status
    const groups: Record<string, any[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      overdue: [],
    };

    for (const m of milestones) {
      // Auto-detect overdue
      const status =
        m.status === 'pending' || m.status === 'in_progress'
          ? new Date(m.dueDate) < new Date()
            ? 'overdue'
            : m.status
          : m.status;

      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push({ ...m, effectiveStatus: status });
    }

    return groups;
  }

  // ── Progress ────────────────────────────────────────────────

  /**
   * Auto-calculate milestone progress based on linked tasks.
   * Progress = percentage of DONE + CLOSED tasks.
   */
  async calcProgress(milestoneId: string): Promise<number> {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: {
        id: true,
        tasks: {
          select: {
            task: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!milestone || milestone.tasks.length === 0) {
      return 0;
    }

    const total = milestone.tasks.length;
    const completed = milestone.tasks.filter((t) =>
      ['DONE', 'CLOSED'].includes(t.task.status),
    ).length;

    return Math.round((completed / total) * 100);
  }
}
