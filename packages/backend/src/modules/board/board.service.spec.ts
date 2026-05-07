import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardService } from './board.service';
import { UpdateColumnDto } from './dto/update-column.dto';
import { TaskStatus } from '@prisma/client';

describe('BoardService', () => {
  let service: BoardService;
  let prisma: any;

  const mockTeam = {
    id: 'team-1',
    deletedAt: null,
  };

  const mockColumns = [
    {
      id: 'col-1',
      teamId: 'team-1',
      name: 'To Do',
      statusMapping: 'TODO',
      color: '#6B7280',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'col-2',
      teamId: 'team-1',
      name: 'In Progress',
      statusMapping: 'IN_PROGRESS',
      color: '#3B82F6',
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockTask = {
    id: 'task-1',
    title: 'Test task',
    status: TaskStatus.TODO,
    sortOrder: 0,
    assignees: [],
    tags: [],
    creator: { id: 'user-1', email: 'a@b.com', displayName: 'User', avatar: null },
  };

  const mockGanttTask = {
    id: 'task-1',
    title: 'Test task',
    status: TaskStatus.TODO,
    priority: 'MEDIUM',
    sortOrder: 0,
    dueDate: new Date('2026-05-15'),
    createdAt: new Date('2026-04-01'),
    parentTaskId: null,
    assignees: [],
    tags: [],
    creator: { id: 'user-1', email: 'a@b.com', displayName: 'User', avatar: null },
    taskRelations: [],
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      team: {
        findUnique: jest.fn(),
      },
      boardColumn: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BoardService>(BoardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── getBoard ────────────────────────────────────────────────

  describe('getBoard', () => {
    it('should return board columns with grouped tasks', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.findMany.mockResolvedValue(mockColumns);
      // Return tasks for TODO column, empty for IN_PROGRESS
      prisma.task.findMany
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([]);

      const result = await service.getBoard('team-1');

      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        select: { id: true, deletedAt: true },
      });
      expect(prisma.boardColumn.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].column.name).toBe('To Do');
      expect(result[0].tasks).toHaveLength(1);
      expect(result[1].column.name).toBe('In Progress');
      expect(result[1].tasks).toHaveLength(0);
    });

    it('should return default board when no columns exist', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.findMany.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);

      const result = await service.getBoard('team-1');

      expect(result).toHaveLength(4);
      expect(result[0].column.name).toBe('To Do');
      expect(result[0].column.statusMapping).toBe('TODO');
      expect(result[1].column.name).toBe('In Progress');
      expect(result[1].column.statusMapping).toBe('IN_PROGRESS');
      expect(result[2].column.name).toBe('Done');
      expect(result[2].column.statusMapping).toBe('DONE');
      expect(result[3].column.name).toBe('Closed');
      expect(result[3].column.statusMapping).toBe('CLOSED');
      // Default columns have id: null
      expect(result[0].column.id).toBeNull();
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getBoard('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.boardColumn.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when team is soft-deleted', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', deletedAt: new Date() });

      await expect(service.getBoard('team-1')).rejects.toThrow(NotFoundException);
    });

    it('should fetch tasks filtered by team and status mapping', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.findMany.mockResolvedValue(mockColumns);
      prisma.task.findMany.mockResolvedValue([]);

      await service.getBoard('team-1');

      // First column (TODO)
      expect(prisma.task.findMany).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          where: { teamId: 'team-1', status: 'TODO', deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }),
      );
      // Second column (IN_PROGRESS)
      expect(prisma.task.findMany).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          where: { teamId: 'team-1', status: 'IN_PROGRESS', deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }),
      );
    });
  });

  // ── updateColumnConfig ──────────────────────────────────────

  describe('updateColumnConfig', () => {
    const dto: UpdateColumnDto = {
      columns: [
        { id: 'col-1', name: 'To Do Updated', statusMapping: TaskStatus.TODO, color: '#111111', sortOrder: 0 },
        { name: 'New Column', statusMapping: TaskStatus.DONE, color: '#222222', sortOrder: 2 },
      ],
    };

    it('should update existing columns and create new ones', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.update.mockResolvedValue({
        id: 'col-1',
        teamId: 'team-1',
        name: 'To Do Updated',
        statusMapping: 'TODO',
        color: '#111111',
        sortOrder: 0,
      });
      prisma.boardColumn.create.mockResolvedValue({
        id: 'col-3',
        teamId: 'team-1',
        name: 'New Column',
        statusMapping: 'DONE',
        color: '#222222',
        sortOrder: 2,
      });

      const result = await service.updateColumnConfig('team-1', dto);

      expect(prisma.boardColumn.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: {
          name: 'To Do Updated',
          statusMapping: TaskStatus.TODO,
          color: '#111111',
          sortOrder: 0,
        },
      });
      expect(prisma.boardColumn.create).toHaveBeenCalledWith({
        data: {
          teamId: 'team-1',
          name: 'New Column',
          statusMapping: TaskStatus.DONE,
          color: '#222222',
          sortOrder: 2,
        },
      });
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.updateColumnConfig('nonexistent', dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.boardColumn.update).not.toHaveBeenCalled();
      expect(prisma.boardColumn.create).not.toHaveBeenCalled();
    });

    it('should handle color being null gracefully', async () => {
      const dtoNoColor: UpdateColumnDto = {
        columns: [
          { name: 'No Color', statusMapping: TaskStatus.TODO, sortOrder: 0 },
        ],
      };
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.create.mockResolvedValue({
        id: 'col-new',
        teamId: 'team-1',
        name: 'No Color',
        statusMapping: 'TODO',
        color: null,
        sortOrder: 0,
      });

      const result = await service.updateColumnConfig('team-1', dtoNoColor);

      expect(prisma.boardColumn.create).toHaveBeenCalledWith({
        data: {
          teamId: 'team-1',
          name: 'No Color',
          statusMapping: TaskStatus.TODO,
          color: null,
          sortOrder: 0,
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should delete columns listed in deletedIds', async () => {
      const dtoWithDelete: UpdateColumnDto = {
        columns: [
          { id: 'col-2', name: 'In Progress', statusMapping: TaskStatus.IN_PROGRESS, color: '#3B82F6', sortOrder: 1 },
        ],
        deletedIds: ['col-1'],
      };
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.boardColumn.deleteMany.mockResolvedValue({ count: 1 });
      prisma.boardColumn.update.mockResolvedValue({
        id: 'col-2',
        teamId: 'team-1',
        name: 'In Progress',
        statusMapping: 'IN_PROGRESS',
        color: '#3B82F6',
        sortOrder: 1,
      });

      const result = await service.updateColumnConfig('team-1', dtoWithDelete);

      expect(prisma.boardColumn.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['col-1'] }, teamId: 'team-1' },
      });
      expect(prisma.boardColumn.update).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  // ── getGanttData ────────────────────────────────────────────

  describe('getGanttData', () => {
    it('should return gantt chart data with dates and dependencies', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.task.findMany.mockResolvedValue([mockGanttTask]);

      const result = await service.getGanttData('team-1');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1', deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
      expect(result[0].title).toBe('Test task');
      expect(result[0].startDate).toBeDefined();
      expect(result[0].endDate).toBeDefined();
      expect(result[0].dependencies).toEqual([]);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getGanttData('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should handle tasks with null dueDate', async () => {
      const taskNoDue = { ...mockGanttTask, dueDate: null };
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.task.findMany.mockResolvedValue([taskNoDue]);

      const result = await service.getGanttData('team-1');

      expect(result[0].endDate).toBeNull();
    });

    it('should include parentTaskId as dependency', async () => {
      const taskWithParent = {
        ...mockGanttTask,
        parentTaskId: 'task-0',
        taskRelations: [{ relatedTaskId: 'task-2' }],
      };
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.task.findMany.mockResolvedValue([taskWithParent]);

      const result = await service.getGanttData('team-1');

      expect(result[0].parentTaskId).toBe('task-0');
      expect(result[0].dependencies).toContain('task-2');
    });
  });

  // ── getCalendarData ─────────────────────────────────────────

  describe('getCalendarData', () => {
    it('should return tasks grouped by due date', async () => {
      const task1 = { ...mockGanttTask, id: 'task-1', dueDate: new Date('2026-05-15') };
      const task2 = {
        ...mockGanttTask,
        id: 'task-2',
        dueDate: new Date('2026-05-15'),
        title: 'Second task',
      };
      const task3 = {
        ...mockGanttTask,
        id: 'task-3',
        dueDate: new Date('2026-05-20'),
        title: 'Later task',
      };
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.task.findMany.mockResolvedValue([task1, task2, task3]);

      const result = await service.getCalendarData('team-1');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1', deletedAt: null, dueDate: { not: null } },
          orderBy: { dueDate: 'asc' },
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-05-15');
      expect(result[0].tasks).toHaveLength(2);
      expect(result[1].date).toBe('2026-05-20');
      expect(result[1].tasks).toHaveLength(1);
    });

    it('should return empty array when no tasks have due dates', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam);
      prisma.task.findMany.mockResolvedValue([]);

      const result = await service.getCalendarData('team-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getCalendarData('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });
});
