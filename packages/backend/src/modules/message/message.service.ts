import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

// Internal type: SendMessageDto without teamId, plus teamId from URL param
export interface SendMessagePayload extends SendMessageDto {
  teamId: string;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Send ────────────────────────────────────────────────────

  /**
   * Persist a message to the database.
   * Supports quick-create task (@task) and document reference (@doc).
   */
  async sendMessage(userId: string, dto: SendMessagePayload) {
    const message = await this.prisma.message.create({
      data: {
        teamId: dto.teamId,
        senderId: userId,
        content: dto.content,
        type: dto.type ?? 'TEXT',
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    const results: Record<string, unknown> = { message };

    // Quick-create a task from message (@task)
    if (dto.quickCreateTaskTitle) {
      try {
        const task = await this.prisma.task.create({
          data: {
            title: dto.quickCreateTaskTitle,
            description: dto.content,
            teamId: dto.teamId,
            creatorId: userId,
            status: 'TODO',
          },
        });
        results.quickCreatedTask = task;
        this.logger.log(`Quick-created task "${task.title}" (${task.id}) from message ${message.id}`);
      } catch (err) {
        this.logger.warn(`Failed to quick-create task from message: ${(err as Error).message}`);
      }
    }

    // Document references (@doc)
    if (dto.references && dto.references.length > 0) {
      const refs = [];
      for (const ref of dto.references) {
        if (ref.type === 'doc') {
          try {
            const doc = await this.prisma.document.findUnique({
              where: { id: ref.resourceId },
              select: { id: true, name: true, type: true },
            });
            if (doc) {
              refs.push(doc);
            }
          } catch {
            this.logger.warn(`Document reference ${ref.resourceId} not found`);
          }
        }
      }
      results.references = refs;
    }

    this.logger.log(`Message ${message.id} sent in team ${dto.teamId} by user ${userId}`);
    return results;
  }

  // ── History (cursor-based pagination) ──────────────────────

  /**
   * Get message history for a team with cursor-based pagination.
   *
   * @param teamId Team ID
   * @param cursor Optional cursor (message ID) for pagination
   * @param limit Number of messages to return (default 50)
   */
  async getHistory(teamId: string, cursor?: string, limit = 50) {
    const where: any = { teamId };

    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        reads: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    const nextCursor =
      hasMore && messages.length > 0
        ? messages[messages.length - 1].id
        : null;

    return {
      items: messages.reverse(), // return in chronological order
      nextCursor,
      hasMore,
    };
  }

  // ── Search ──────────────────────────────────────────────────

  /**
   * Search messages in a team by text content.
   */
  async search(teamId: string, query: string, page = 1, limit = 20) {
    if (!query || query.trim().length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: {
          teamId,
          content: { contains: query, mode: 'insensitive' },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.message.count({
        where: {
          teamId,
          content: { contains: query, mode: 'insensitive' },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Read receipts ───────────────────────────────────────────

  /**
   * Mark a message as read by a user.
   */
  async markAsRead(messageId: string, userId: string) {
    await this.prisma.messageRead.upsert({
      where: {
        messageId_userId: { messageId, userId },
      },
      update: { readAt: new Date() },
      create: { messageId, userId },
    });
  }

  /**
   * Get read status for a message — who has read it and when.
   */
  async getReadStatus(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const reads = await this.prisma.messageRead.findMany({
      where: { messageId },
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
      orderBy: { readAt: 'desc' },
    });

    return {
      messageId,
      totalReads: reads.length,
      readers: reads.map((r) => ({
        user: r.user,
        readAt: r.readAt,
      })),
    };
  }
}
