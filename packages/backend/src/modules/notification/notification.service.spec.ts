import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;

  const mockNotification = {
    id: 'notif-1',
    type: 'TASK_ASSIGNED',
    title: 'You have been assigned a task',
    content: 'Please review the design specs',
    resourceType: 'task',
    resourceId: 'task-1',
    userId: 'user-1',
    isRead: false,
    createdAt: new Date(),
  };

  const mockNotificationRead = {
    ...mockNotification,
    isRead: true,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((queries: any) => Promise.all(queries)),
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue({ messageId: 'mock-email-id' }) },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a notification with all fields', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create({
        type: 'TASK_ASSIGNED',
        title: 'You have been assigned a task',
        content: 'Please review the design specs',
        resourceType: 'task',
        resourceId: 'task-1',
        userId: 'user-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          type: 'TASK_ASSIGNED',
          title: 'You have been assigned a task',
          content: 'Please review the design specs',
          resourceType: 'task',
          resourceId: 'task-1',
          userId: 'user-1',
        },
      });
      expect(result.id).toBe('notif-1');
      expect(result.type).toBe('TASK_ASSIGNED');
    });

    it('should create a notification with only required fields', async () => {
      const minimalNotif = { ...mockNotification, title: 'Welcome!', content: undefined, resourceType: undefined, resourceId: undefined };
      prisma.notification.create.mockResolvedValue(minimalNotif);

      const result = await service.create({
        type: 'TEAM_INVITE',
        title: 'Welcome!',
        userId: 'user-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          type: 'TEAM_INVITE',
          title: 'Welcome!',
          content: undefined,
          resourceType: undefined,
          resourceId: undefined,
          userId: 'user-1',
        },
      });
      expect(result.title).toBe('Welcome!');
    });
  });

  // ── findByUser ──────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return paginated notifications without filters', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const query: QueryNotificationDto = {};
      const result = await service.findByUser('user-1', query);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });

    it('should filter by type', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const query: QueryNotificationDto = { type: 'TASK_ASSIGNED' };
      await service.findByUser('user-1', query);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', type: 'TASK_ASSIGNED' },
        }),
      );
    });

    it('should filter by isRead', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const query: QueryNotificationDto = { isRead: false };
      await service.findByUser('user-1', query);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isRead: false },
        }),
      );
    });

    it('should support custom page and limit', async () => {
      prisma.notification.findMany.mockResolvedValue(Array(5).fill(mockNotification));
      prisma.notification.count.mockResolvedValue(25);

      const query: QueryNotificationDto = { page: 3, limit: 5 };
      const result = await service.findByUser('user-1', query);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.meta.page).toBe(3);
      expect(result.meta.pageSize).toBe(5);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should return empty list when no notifications exist', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const query: QueryNotificationDto = {};
      const result = await service.findByUser('user-1', query);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ── markRead ────────────────────────────────────────────────

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
      });
      prisma.notification.update.mockResolvedValue(mockNotificationRead);

      const result = await service.markRead('notif-1', 'user-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.markRead('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-2',
        isRead: false,
      });

      await expect(
        service.markRead('notif-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should return early if already read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true,
      });

      const result = await service.markRead('notif-1', 'user-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });
  });

  // ── markAllRead ─────────────────────────────────────────────

  describe('markAllRead', () => {
    it('should mark all unread notifications as read and return count', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
      expect(result.count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllRead('user-1');

      expect(result.count).toBe(0);
    });
  });
});
