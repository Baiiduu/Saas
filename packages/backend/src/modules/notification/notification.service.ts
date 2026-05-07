import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getPaginationParams, paginate } from '../../common/utils/pagination';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { EmailService } from './email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a notification for a specific user.
   */
  async create(params: {
    type: NotificationType;
    title: string;
    content?: string;
    resourceType?: string;
    resourceId?: string;
    userId: string;
  }) {
    const { type, title, content, resourceType, resourceId, userId } = params;

    const notification = await this.prisma.notification.create({
      data: {
        type,
        title,
        content,
        resourceType,
        resourceId,
        userId,
      },
    });

    this.logger.log(`Notification ${notification.id} created for user ${userId}: ${type}`);
    return notification;
  }

  /**
   * Get paginated notifications for a user, with optional filters.
   */
  async findByUser(userId: string, query: QueryNotificationDto) {
    const { page, limit } = query;
    const { skip, take, page: pg } = getPaginationParams({
      page,
      pageSize: limit,
    });
    const pageSize = take;

    const where: any = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(items, total, { skip, take, page: pg, pageSize });
  }

  /**
   * Mark a single notification as read. Only the notification owner can mark it.
   */
  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, isRead: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only read your own notifications');
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    this.logger.log(`Notification ${notificationId} marked as read by user ${userId}`);
    return updated;
  }

  /**
   * Mark all unread notifications for the current user as read.
   */
  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);
    return { count: result.count };
  }

  /**
   * Send a notification and optionally dispatch an email.
   * Uses the EmailService which simulates Bull queue + nodemailer.
   */
  async createAndSend(params: {
    type: NotificationType;
    title: string;
    content?: string;
    resourceType?: string;
    resourceId?: string;
    userId: string;
    sendEmail?: boolean;
  }) {
    const { sendEmail, ...createParams } = params;

    // Create the in-app notification
    const notification = await this.create(createParams);

    // Optionally send an email notification
    if (sendEmail) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { email: true, displayName: true },
        });

        if (user?.email) {
          await this.emailService.send({
            to: user.email,
            subject: params.title,
            body: params.content ?? params.title,
            html: params.content
              ? `<p>${params.content}</p>`
              : `<p>${params.title}</p>`,
          });
          this.logger.log(`Email notification sent to ${user.email} for notification ${notification.id}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to send email notification: ${(err as Error).message}`);
      }
    }

    return notification;
  }
}
