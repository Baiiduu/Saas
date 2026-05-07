import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: any;

  beforeEach(async () => {
    dashboardService = {
      getUserStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/dashboard/user', () => {
    it('should call dashboardService.getUserStats with userId', async () => {
      const mockStats = {
        totalTasks: 10,
        completionRate: 60,
        pendingCount: 4,
        overdueCount: 2,
      };
      dashboardService.getUserStats.mockResolvedValue(mockStats);

      const result = await controller.getUserStats('user-1');

      expect(dashboardService.getUserStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });

    it('should propagate errors from the service', async () => {
      const error = new Error('Database connection failed');
      dashboardService.getUserStats.mockRejectedValue(error);

      await expect(controller.getUserStats('user-1')).rejects.toThrow(error);
    });
  });
});
