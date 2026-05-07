import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      taskAssignee: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── getUserStats ────────────────────────────────────────────

  describe('getUserStats', () => {
    it('should return correct stats for a user with tasks', async () => {
      prisma.taskAssignee.count
        .mockResolvedValueOnce(10)   // totalTasks
        .mockResolvedValueOnce(6)    // completedTasks
        .mockResolvedValueOnce(4)    // pendingTasks
        .mockResolvedValueOnce(2);   // overdueTasks

      const result = await service.getUserStats('user-1');

      expect(prisma.taskAssignee.count).toHaveBeenCalledTimes(4);

      expect(prisma.taskAssignee.count).toHaveBeenNthCalledWith(1, {
        where: { userId: 'user-1' },
      });
      expect(prisma.taskAssignee.count).toHaveBeenNthCalledWith(2, {
        where: {
          userId: 'user-1',
          task: { status: { in: ['DONE', 'CLOSED'] } },
        },
      });
      expect(prisma.taskAssignee.count).toHaveBeenNthCalledWith(3, {
        where: {
          userId: 'user-1',
          task: { status: { in: ['TODO', 'IN_PROGRESS'] } },
        },
      });
      expect(prisma.taskAssignee.count).toHaveBeenNthCalledWith(4, {
        where: {
          userId: 'user-1',
          task: {
            status: { notIn: ['DONE', 'CLOSED'] },
            dueDate: { lt: expect.any(Date) },
          },
        },
      });

      expect(result).toEqual({
        totalTasks: 10,
        completionRate: 60,
        pendingCount: 4,
        overdueCount: 2,
      });
    });

    it('should handle zero tasks (completionRate = 0)', async () => {
      prisma.taskAssignee.count
        .mockResolvedValueOnce(0)   // totalTasks
        .mockResolvedValueOnce(0)   // completedTasks
        .mockResolvedValueOnce(0)   // pendingTasks
        .mockResolvedValueOnce(0);  // overdueTasks

      const result = await service.getUserStats('user-1');

      expect(result).toEqual({
        totalTasks: 0,
        completionRate: 0,
        pendingCount: 0,
        overdueCount: 0,
      });
    });

    it('should query correct Prisma counts for partial data', async () => {
      prisma.taskAssignee.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const result = await service.getUserStats('user-1');

      expect(result).toEqual({
        totalTasks: 5,
        completionRate: 0,
        pendingCount: 3,
        overdueCount: 1,
      });
    });
  });
});
