import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { getPaginationParams, paginate } from '../../common/utils/pagination';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new comment on a resource.
   * Supports parentId for replies and parses @mentions as a placeholder.
   */
  async create(userId: string, dto: CreateCommentDto) {
    const { content, resourceType, resourceId, parentId } = dto;

    // Validate parentId if provided
    if (parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Detect @mentions (simple regex — placeholder for notification system)
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)|@(\w+)/g;
    const mentions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentioned = match[1] ?? match[3];
      if (mentioned) {
        mentions.push(mentioned);
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        content,
        resourceType,
        resourceId,
        creatorId: userId,
        parentId: parentId ?? null,
      },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (mentions.length > 0) {
      this.logger.log(
        `Comment ${comment.id} created with @mentions: [${mentions.join(', ')}] — notification trigger placeholder`,
      );
    }

    this.logger.log(`Comment ${comment.id} created by user ${userId} on ${resourceType}:${resourceId}`);
    return comment;
  }

  /**
   * Get paginated top-level comments for a resource, ordered by newest first.
   * Includes nested replies and creator info.
   */
  async findByResource(
    resourceType: string,
    resourceId: string,
    page?: number,
    pageSize?: number,
  ) {
    const { skip, page: p, pageSize: ps } = getPaginationParams({ page, pageSize });

    const where = {
      resourceType,
      resourceId,
      deletedAt: null,
      parentId: null, // top-level comments only
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        skip,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              creator: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return paginate(items, total, { skip, take: ps, page: p, pageSize: ps });
  }

  /**
   * Update comment content. Only the original creator can edit.
   * Sets isEdited to true automatically.
   */
  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, creatorId: true, deletedAt: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.creatorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Comment ${commentId} edited by user ${userId}`);
    return updated;
  }

  /**
   * Soft-delete a comment. Owner or team admin/owner can delete.
   */
  async delete(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        creatorId: true,
        deletedAt: true,
        resourceType: true,
        resourceId: true,
      },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    // Allow if user is the owner
    if (comment.creatorId === userId) {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`Comment ${commentId} soft-deleted by owner ${userId}`);
      return;
    }

    // Check if user is team admin/owner for the resource
    const isAdmin = await this.isTeamAdminForResource(comment.resourceType, comment.resourceId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('You can only delete your own comments or must be a team admin');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Comment ${commentId} soft-deleted by admin ${userId}`);
  }

  /**
   * Generate attachment preview signed URLs for given file identifiers.
   * Returns a map of fileId -> preview URL (signed, time-limited).
   *
   * In production this would integrate with object storage (MinIO/S3)
   * to generate presigned GET URLs. For now returns placeholder URLs.
   */
  async getAttachmentPreviewUrls(fileIds: string[]): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};
    for (const fileId of fileIds) {
      // Placeholder: In production, call MinIO/S3 presigned URL generation
      urls[fileId] = `/api/v1/files/${fileId}/preview?signature=placeholder&expires=${Date.now() + 3600000}`;
    }
    return urls;
  }

  // ── Private Helpers ──────────────────────────────────────────

  /**
   * Check if a user is a team admin or owner for the team that owns a given resource.
   */
  private async isTeamAdminForResource(
    resourceType: string,
    resourceId: string,
    userId: string,
  ): Promise<boolean> {
    let teamId: string | null = null;

    if (resourceType === 'task') {
      const task = await this.prisma.task.findUnique({
        where: { id: resourceId },
        select: { teamId: true },
      });
      teamId = task?.teamId ?? null;
    } else if (resourceType === 'doc' || resourceType === 'document') {
      const doc = await this.prisma.document.findUnique({
        where: { id: resourceId },
        select: { teamId: true },
      });
      teamId = doc?.teamId ?? null;
    }

    if (!teamId) return false;

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    if (!membership) return false;

    return membership.role === 'ADMIN' || membership.role === 'OWNER';
  }
}
