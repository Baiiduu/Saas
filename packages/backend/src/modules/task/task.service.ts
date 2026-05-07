import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskRelationDto } from './dto/task-relation.dto';
import { BatchTaskDto, BatchAction } from './dto/batch-task.dto';
import { TaskStatus, Priority } from '@prisma/client';

/**
 * Valid status transitions for the task lifecycle.
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.TODO],
  [TaskStatus.DONE]: [TaskStatus.CLOSED, TaskStatus.IN_PROGRESS],
  [TaskStatus.CLOSED]: [], // terminal state
};

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────

  /**
   * Create a new task with optional assignees and tags.
   */
  async create(userId: string, dto: CreateTaskDto) {
    const { assigneeIds, tagNames, dueDate, parentTaskId, ...rest } = dto;

    const task = await this.prisma.task.create({
      data: {
        ...rest,
        parentTaskId: parentTaskId ?? undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        creatorId: userId,
        assignees: assigneeIds?.length
          ? {
              create: assigneeIds.map((uid) => ({
                userId: uid,
              })),
            }
          : undefined,
        tags: tagNames?.length
          ? {
              create: tagNames.map((name) => ({ name })),
            }
          : undefined,
      },
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

    this.logger.log(`Task "${task.title}" (${task.id}) created by user ${userId}`);
    return task;
  }

  /**
   * List tasks with pagination, filtering, and sorting.
   */
  async findAll(query: QueryTaskDto) {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assigneeId,
      dueDateFrom,
      dueDateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      teamId,
      search,
    } = query;

    const where: any = { deletedAt: null };

    if (teamId) {
      where.teamId = teamId;
    }
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (assigneeId) {
      where.assignees = {
        some: { userId: assigneeId },
      };
    }
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) {
        where.dueDate.gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        where.dueDate.lte = new Date(dueDateTo);
      }
    }

    // Text search on title and description
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Whitelist allowed sort fields to prevent injection
    const allowedSortFields = ['createdAt', 'updatedAt', 'dueDate', 'sortOrder', 'priority', 'status', 'title'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [field]: order },
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
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single task by ID with all relations.
   */
  async findById(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
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
        parentTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        subTasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  /**
   * Update task fields with status transition validation.
   */
  async update(taskId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    // Validate status transition if status is changing
    if (dto.status !== undefined && dto.status !== existing.status) {
      this.validateStatusTransition(existing.status, dto.status);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
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

    this.logger.log(`Task ${taskId} updated`);
    return updated;
  }

  /**
   * Soft-delete a task by setting deletedAt.
   */
  async delete(taskId: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Task ${taskId} soft-deleted`);
  }

  // ── Assignment ─────────────────────────────────────────────

  /**
   * Replace task assignees with the given user IDs.
   */
  async assign(taskId: string, userIds: string[]) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    // Delete old assignees and create new ones in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId } });

      if (userIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: userIds.map((uid) => ({
            taskId,
            userId: uid,
          })),
        });
      }
    });

    // Return updated task with assignees
    return this.prisma.task.findUnique({
      where: { id: taskId },
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
  }

  // ── Position (Drag-drop) ───────────────────────────────────

  /**
   * Update task status and sort order (used after drag-drop).
   */
  async updatePosition(taskId: string, status: TaskStatus, sortOrder: number) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    // Validate status transition if status is changing
    if (status !== existing.status) {
      this.validateStatusTransition(existing.status, status);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status, sortOrder },
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

    this.logger.log(`Task ${taskId} position updated: status=${status}, sortOrder=${sortOrder}`);
    return updated;
  }

  // ── Subtask Tree ──────────────────────────────────────────

  /**
   * Recursively fetch the subtask tree for a given parent task.
   */
  async getSubTaskTree(taskId: string): Promise<any> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    return this.buildSubTaskTree(taskId);
  }

  /**
   * Internal recursive helper to build subtask tree.
   */
  private async buildSubTaskTree(parentId: string): Promise<any[]> {
    const subtasks = await this.prisma.task.findMany({
      where: { parentTaskId: parentId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        parentTaskId: true,
      },
    });

    for (const sub of subtasks) {
      (sub as any).children = await this.buildSubTaskTree(sub.id);
    }

    return subtasks;
  }

  // ── Relations ─────────────────────────────────────────────

  /**
   * Link a task to another resource (task / document / resource item).
   */
  async addRelation(taskId: string, dto: CreateTaskRelationDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const relation = await this.prisma.taskRelation.create({
      data: {
        taskId,
        relatedTaskId: dto.relatedTaskId ?? null,
        relatedDocId: dto.relatedDocId ?? null,
        relatedResourceId: dto.relatedResourceId ?? null,
        relationType: dto.relationType,
      },
      include: {
        relatedTask: {
          select: { id: true, title: true, status: true },
        },
        relatedDoc: {
          select: { id: true, name: true, type: true },
        },
        relatedResource: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    this.logger.log(`Relation added to task ${taskId}: type=${dto.relationType}`);
    return relation;
  }

  /**
   * Get all relations for a given task.
   */
  async getRelations(taskId: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskRelation.findMany({
      where: { taskId },
      include: {
        relatedTask: {
          select: { id: true, title: true, status: true },
        },
        relatedDoc: {
          select: { id: true, name: true, type: true },
        },
        relatedResource: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  // ── Batch Operations ──────────────────────────────────────

  /**
   * Atomically update status / priority / assignees on multiple tasks.
   * Runs inside a Prisma transaction.
   */
  async batchUpdate(ids: string[], data: {
    status?: TaskStatus;
    priority?: Priority;
    assigneeIds?: string[];
  }) {
    if (ids.length === 0) {
      return { updated: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, status: true },
      });

      if (tasks.length !== ids.length) {
        throw new NotFoundException('One or more tasks not found');
      }

      // Validate status transitions if status is changing
      if (data.status !== undefined) {
        for (const task of tasks) {
          if (data.status !== task.status) {
            this.validateStatusTransition(task.status, data.status);
          }
        }

        await tx.task.updateMany({
          where: { id: { in: ids } },
          data: { status: data.status },
        });
      }

      // Update priority
      if (data.priority !== undefined) {
        await tx.task.updateMany({
          where: { id: { in: ids } },
          data: { priority: data.priority },
        });
      }

      // Replace assignees
      if (data.assigneeIds !== undefined) {
        for (const taskId of ids) {
          await tx.taskAssignee.deleteMany({ where: { taskId } });
          if (data.assigneeIds.length > 0) {
            await tx.taskAssignee.createMany({
              data: data.assigneeIds.map((userId) => ({
                taskId,
                userId,
              })),
            });
          }
        }
      }

      this.logger.log(`Batch updated ${ids.length} tasks`);
      return { updated: ids.length };
    });
  }

  /**
   * Batch soft-delete multiple tasks.
   */
  async batchDelete(ids: string[]) {
    if (ids.length === 0) {
      return { deleted: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });

      if (tasks.length !== ids.length) {
        throw new NotFoundException('One or more tasks not found');
      }

      await tx.task.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Batch soft-deleted ${ids.length} tasks`);
      return { deleted: ids.length };
    });
  }

  // ── Batch via DTO ─────────────────────────────────────────

  /**
   * Dispatch a batch DTO to the correct batch operation.
   */
  async batch(dto: BatchTaskDto) {
    if (dto.action === BatchAction.DELETE) {
      return this.batchDelete(dto.ids);
    }
    return this.batchUpdate(dto.ids, {
      status: dto.status,
      priority: dto.priority,
      assigneeIds: dto.assigneeIds,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Validate that a status transition is allowed.
   */
  private validateStatusTransition(from: TaskStatus, to: TaskStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition task from "${from}" to "${to}". ` +
        `Allowed transitions from "${from}": ${allowed.join(', ') || 'none'}`,
      );
    }
  }
}
