import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: any;

  const mockNotification = {
    id: 'notif-1',
    type: 'TASK_ASSIGNED',
    title: 'You have been assigned a task',
    content: 'Please review',
    resourceType: 'task',
    resourceId: 'task-1',
    userId: 'user-1',
    isRead: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    notificationService = {
      findByUser: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/notifications', () => {
    it('should call notificationService.findByUser with userId and query', async () => {
      const paginatedResult = {
        data: [mockNotification],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
      notificationService.findByUser.mockResolvedValue(paginatedResult);

      const query: QueryNotificationDto = { type: 'TASK_ASSIGNED' };
      const result = await controller.findByUser('user-1', query);

      expect(notificationService.findByUser).toHaveBeenCalledWith('user-1', query);
      expect(result).toEqual(paginatedResult);
    });

    it('should pass empty query object when no filters provided', async () => {
      notificationService.findByUser.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });

      const query: QueryNotificationDto = {};
      await controller.findByUser('user-1', query);

      expect(notificationService.findByUser).toHaveBeenCalledWith('user-1', query);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should call notificationService.markRead with id and userId', async () => {
      notificationService.markRead.mockResolvedValue({ ...mockNotification, isRead: true });

      const result = await controller.markRead('notif-1', 'user-1');

      expect(notificationService.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(result.isRead).toBe(true);
    });
  });

  describe('POST /api/v1/notifications/read-all', () => {
    it('should call notificationService.markAllRead with userId', async () => {
      notificationService.markAllRead.mockResolvedValue({ count: 5 });

      const result = await controller.markAllRead('user-1');

      expect(notificationService.markAllRead).toHaveBeenCalledWith('user-1');
      expect(result.count).toBe(5);
    });
  });
});
