import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentService', () => {
  let service: CommentService;
  let prisma: any;

  const mockCreator = {
    id: 'user-1',
    displayName: 'Alice',
    avatar: null,
  };

  const mockComment = {
    id: 'comment-1',
    content: 'Great work on this task!',
    resourceType: 'task',
    resourceId: 'resource-1',
    creatorId: 'user-1',
    parentId: null,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creator: mockCreator,
    replies: [],
  };

  const mockReplies = [
    {
      id: 'reply-1',
      content: 'Thanks!',
      resourceType: 'task',
      resourceId: 'resource-1',
      creatorId: 'user-2',
      parentId: 'comment-1',
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      creator: { id: 'user-2', displayName: 'Bob', avatar: null },
    },
  ];

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.resolve(arg);
      }),
      comment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      teamMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateCommentDto = {
      content: 'Great work on this task!',
      resourceType: 'task',
      resourceId: 'resource-1',
    };

    it('should create a comment with valid data', async () => {
      prisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create('user-1', dto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          content: dto.content,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          creatorId: 'user-1',
          parentId: null,
        },
        include: {
          creator: {
            select: { id: true, displayName: true, avatar: true },
          },
        },
      });
      expect(result.id).toBe('comment-1');
      expect(result.creator.displayName).toBe('Alice');
    });

    it('should parse @mentions from content', async () => {
      const dtoWithMentions: CreateCommentDto = {
        content: 'Hey @Alice and @Bob, please review this!',
        resourceType: 'task',
        resourceId: 'resource-1',
      };
      prisma.comment.create.mockResolvedValue({
        ...mockComment,
        content: dtoWithMentions.content,
      });

      const result = await service.create('user-1', dtoWithMentions);

      expect(result.content).toContain('@Alice');
      expect(result.content).toContain('@Bob');
      expect(prisma.comment.create).toHaveBeenCalled();
    });

    it('should parse bracket-style @mentions like @[Name](id)', async () => {
      const dtoWithBracketMentions: CreateCommentDto = {
        content: 'Assign @[Alice](user-1) to review',
        resourceType: 'task',
        resourceId: 'resource-1',
      };
      prisma.comment.create.mockResolvedValue({
        ...mockComment,
        content: dtoWithBracketMentions.content,
      });

      const result = await service.create('user-1', dtoWithBracketMentions);

      expect(result.content).toContain('@[Alice](user-1)');
    });

    it('should create a comment with empty mentions gracefully', async () => {
      const dtoNoMentions: CreateCommentDto = {
        content: 'Just a plain comment without mentions',
        resourceType: 'task',
        resourceId: 'resource-1',
      };
      prisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create('user-1', dtoNoMentions);

      expect(result.id).toBe('comment-1');
    });

    it('should create a reply when parentId is provided', async () => {
      const dtoWithParent: CreateCommentDto = {
        content: 'This is a reply',
        resourceType: 'task',
        resourceId: 'resource-1',
        parentId: 'comment-1',
      };
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        deletedAt: null,
      });
      prisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-1',
        content: 'This is a reply',
        parentId: 'comment-1',
      });

      const result = await service.create('user-2', dtoWithParent);

      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        select: { id: true, deletedAt: true },
      });
      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentId: 'comment-1' }),
        }),
      );
      expect(result.parentId).toBe('comment-1');
    });

    it('should throw NotFoundException when parent comment does not exist', async () => {
      const dtoWithParent: CreateCommentDto = {
        content: 'Orphan reply',
        resourceType: 'task',
        resourceId: 'resource-1',
        parentId: 'nonexistent',
      };
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.create('user-2', dtoWithParent)).rejects.toThrow(NotFoundException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });
  });

  // ── findByResource ──────────────────────────────────────────

  describe('findByResource', () => {
    it('should return paginated top-level comments with default pagination', async () => {
      prisma.comment.findMany.mockResolvedValue([mockComment]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.findByResource('task', 'resource-1');

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            resourceType: 'task',
            resourceId: 'resource-1',
            deletedAt: null,
            parentId: null,
          },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });

    it('should include nested replies for each top-level comment', async () => {
      const commentWithReplies = { ...mockComment, replies: mockReplies };
      prisma.comment.findMany.mockResolvedValue([commentWithReplies]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.findByResource('task', 'resource-1');

      expect(result.data[0].replies).toHaveLength(1);
      expect(result.data[0].replies[0].content).toBe('Thanks!');
    });

    it('should respect custom page and pageSize', async () => {
      prisma.comment.findMany.mockResolvedValue(Array(5).fill(mockComment));
      prisma.comment.count.mockResolvedValue(25);

      const result = await service.findByResource('task', 'resource-1', 2, 5);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.data).toHaveLength(5);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(5);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should return empty list when no comments exist', async () => {
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      const result = await service.findByResource('task', 'nonexistent');

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ── delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft-delete a comment when caller is the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
      });
      prisma.comment.update.mockResolvedValue({ ...mockComment, deletedAt: new Date() });

      await service.delete('comment-1', 'user-1');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException when caller is not the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
      });

      await expect(
        service.delete('comment-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when comment is already soft-deleted', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: new Date(),
      });

      await expect(
        service.delete('comment-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should allow team admin to delete another users comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
        resourceType: 'task',
        resourceId: 'task-1',
      });
      prisma.task.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.teamMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.comment.update.mockResolvedValue({ ...mockComment, deletedAt: new Date() });

      await service.delete('comment-1', 'user-admin');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException when non-admin tries to delete another users comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
        resourceType: 'task',
        resourceId: 'task-1',
      });
      prisma.task.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.teamMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

      await expect(
        service.delete('comment-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateCommentDto = {
      content: 'Updated content',
    };

    it('should update comment content and set isEdited flag', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
      });
      prisma.comment.update.mockResolvedValue({
        ...mockComment,
        content: 'Updated content',
        isEdited: true,
      });

      const result = await service.update('comment-1', 'user-1', updateDto);

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content', isEdited: true },
        include: {
          creator: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      expect(result.isEdited).toBe(true);
      expect(result.content).toBe('Updated content');
    });

    it('should throw ForbiddenException when not the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: null,
      });

      await expect(
        service.update('comment-1', 'user-2', updateDto),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-1', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when comment is soft-deleted', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        creatorId: 'user-1',
        deletedAt: new Date(),
      });

      await expect(
        service.update('comment-1', 'user-1', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
