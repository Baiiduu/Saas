import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { TaskStatus, Priority } from '@prisma/client';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: any;

  const mockTask = {
    id: 'task-1',
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions',
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    dueDate: new Date('2026-05-15'),
    sortOrder: 0,
    teamId: 'team-1',
    creatorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    assignees: [
      {
        id: 'ta-1',
        taskId: 'task-1',
        userId: 'user-2',
        assignedAt: new Date(),
        user: { id: 'user-2', email: 'dev@example.com', displayName: 'Dev', avatar: null },
      },
    ],
    tags: [{ id: 'tag-1', taskId: 'task-1', name: 'frontend' }],
    creator: { id: 'user-1', email: 'creator@example.com', displayName: 'Creator', avatar: null },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((arg: any) => {
        // If arg is a function (callback-style transaction), call it with prisma
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        // If arg is an array (parallel transaction), resolve both
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return Promise.resolve(arg);
      }),
      task: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      taskAssignee: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateTaskDto = {
      title: 'New task',
      description: 'Task description',
      priority: Priority.HIGH,
      dueDate: '2026-06-01T00:00:00.000Z',
      assigneeIds: ['user-2'],
      tagNames: ['frontend', 'urgent'],
      teamId: 'team-1',
    };

    it('should create a task with assignees, tags, and creator', async () => {
      prisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create('user-1', dto);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: dto.title,
            description: dto.description,
            priority: Priority.HIGH,
            dueDate: expect.any(Date),
            creatorId: 'user-1',
            teamId: 'team-1',
            assignees: {
              create: [{ userId: 'user-2' }],
            },
            tags: {
              create: [{ name: 'frontend' }, { name: 'urgent' }],
            },
          }),
        }),
      );
      expect(result.id).toBe(mockTask.id);
    });

    it('should create a task without assignees when none provided', async () => {
      const dtoNoAssignees: CreateTaskDto = {
        title: 'Simple task',
        teamId: 'team-1',
      };
      prisma.task.create.mockResolvedValue({ ...mockTask, assignees: [], tags: [] });

      await service.create('user-1', dtoNoAssignees);

      const callArg = prisma.task.create.mock.calls[0][0];
      expect(callArg.data.assignees).toBeUndefined();
      expect(callArg.data.tags).toBeUndefined();
    });

    it('should create a task without converting dueDate when not provided', async () => {
      const dtoNoDueDate: CreateTaskDto = {
        title: 'No due date',
        teamId: 'team-1',
      };
      prisma.task.create.mockResolvedValue({ ...mockTask, dueDate: null });

      await service.create('user-1', dtoNoDueDate);

      const callArg = prisma.task.create.mock.calls[0][0];
      expect(callArg.data.dueDate).toBeUndefined();
    });
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated tasks with default params', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ status: TaskStatus.TODO } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TaskStatus.TODO }),
        }),
      );
    });

    it('should filter by priority', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ priority: Priority.HIGH } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: Priority.HIGH }),
        }),
      );
    });

    it('should filter by assigneeId', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ assigneeId: 'user-2' } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignees: { some: { userId: 'user-2' } },
          }),
        }),
      );
    });

    it('should filter by due date range', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({
        dueDateFrom: '2026-05-01T00:00:00.000Z',
        dueDateTo: '2026-05-31T00:00:00.000Z',
      } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should filter by teamId', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ teamId: 'team-1' } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: 'team-1' }),
        }),
      );
    });

    it('should sort by allowed fields', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ sortBy: 'dueDate', sortOrder: 'asc' } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dueDate: 'asc' },
        }),
      );
    });

    it('should fall back to createdAt for disallowed sort fields', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ sortBy: 'injected' } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by search text on title and description', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      await service.findAll({ search: 'pipeline' } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'pipeline', mode: 'insensitive' } },
              { description: { contains: 'pipeline', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should paginate correctly', async () => {
      prisma.task.findMany.mockResolvedValue(Array(5).fill(mockTask));
      prisma.task.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 5 } as QueryTaskDto);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.page).toBe(2);
    });
  });

  // ── findById ────────────────────────────────────────────────

  describe('findById', () => {
    it('should return a task when found and not deleted', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await service.findById('task-1');

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: expect.any(Object),
      });
      expect(result.id).toBe('task-1');
    });

    it('should throw NotFoundException when task is not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task is soft-deleted', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...mockTask, deletedAt: new Date() });

      await expect(service.findById('task-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateTaskDto = {
      title: 'Updated title',
      description: 'Updated description',
    };

    it('should update task fields', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, title: 'Updated title' });

      const result = await service.update('task-1', dto);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { title: 'Updated title', description: 'Updated description' },
        }),
      );
      expect(result.title).toBe('Updated title');
    });

    it('should validate status transition TODO→IN_PROGRESS', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS });

      const result = await service.update('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should reject invalid status transition TODO→DONE', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });

      await expect(
        service.update('task-1', { status: TaskStatus.DONE }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status transition TODO→CLOSED', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });

      await expect(
        service.update('task-1', { status: TaskStatus.CLOSED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow IN_PROGRESS→TODO (back to todo)', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.IN_PROGRESS, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.TODO });

      const result = await service.update('task-1', { status: TaskStatus.TODO });

      expect(result.status).toBe(TaskStatus.TODO);
    });

    it('should allow IN_PROGRESS→DONE', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.IN_PROGRESS, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.DONE });

      const result = await service.update('task-1', { status: TaskStatus.DONE });

      expect(result.status).toBe(TaskStatus.DONE);
    });

    it('should allow DONE→IN_PROGRESS (reopen)', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.DONE, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS });

      const result = await service.update('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should allow DONE→CLOSED', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.DONE, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.CLOSED });

      const result = await service.update('task-1', { status: TaskStatus.CLOSED });

      expect(result.status).toBe(TaskStatus.CLOSED);
    });

    it('should reject CLOSED→any (terminal state)', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.CLOSED, deletedAt: null });

      await expect(
        service.update('task-1', { status: TaskStatus.TODO }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('task-1', { status: TaskStatus.IN_PROGRESS }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('task-1', { status: TaskStatus.DONE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow setting same status (no transition)', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });
      prisma.task.update.mockResolvedValue(mockTask);

      await service.update('task-1', { status: TaskStatus.TODO });

      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task is soft-deleted', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: new Date() });

      await expect(service.update('task-1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft-delete a task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, deletedAt: new Date() });

      await service.delete('task-1');

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task is already soft-deleted', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', deletedAt: new Date() });

      await expect(service.delete('task-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── assign ──────────────────────────────────────────────────

  describe('assign', () => {
    it('should replace task assignees', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-1', deletedAt: null })
        .mockResolvedValueOnce(mockTask);
      prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 2 });
      prisma.taskAssignee.createMany.mockResolvedValue({ count: 2 });

      const result = await service.assign('task-1', ['user-2', 'user-3']);

      expect(prisma.taskAssignee.deleteMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
      });
      expect(prisma.taskAssignee.createMany).toHaveBeenCalledWith({
        data: [
          { taskId: 'task-1', userId: 'user-2' },
          { taskId: 'task-1', userId: 'user-3' },
        ],
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('task-1');
    });

    it('should clear all assignees when empty array is passed', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-1', deletedAt: null })
        .mockResolvedValueOnce(mockTask as any);
      prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 2 });

      await service.assign('task-1', []);

      expect(prisma.taskAssignee.deleteMany).toHaveBeenCalled();
      expect(prisma.taskAssignee.createMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.assign('nonexistent', ['user-2'])).rejects.toThrow(NotFoundException);
    });
  });

  // ── updatePosition ──────────────────────────────────────────

  describe('updatePosition', () => {
    it('should update task status and sort order', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS, sortOrder: 2 });

      const result = await service.updatePosition('task-1', TaskStatus.IN_PROGRESS, 2);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: TaskStatus.IN_PROGRESS, sortOrder: 2 },
        include: expect.any(Object),
      });
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.sortOrder).toBe(2);
    });

    it('should validate status transition on position update', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });

      await expect(
        service.updatePosition('task-1', TaskStatus.CLOSED, 0),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('should skip validation when status does not change', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO, deletedAt: null });
      prisma.task.update.mockResolvedValue({ ...mockTask, sortOrder: 5 });

      const result = await service.updatePosition('task-1', TaskStatus.TODO, 5);

      expect(result.sortOrder).toBe(5);
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePosition('nonexistent', TaskStatus.TODO, 0),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
