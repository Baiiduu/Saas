import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentController', () => {
  let controller: CommentController;
  let commentService: any;

  const mockCurrentUser = {
    sub: 'user-1',
    email: 'user@example.com',
    type: 'access' as const,
  };

  const mockComment = {
    id: 'comment-1',
    content: 'Great work!',
    resourceType: 'task',
    resourceId: 'resource-1',
    creatorId: 'user-1',
    parentId: null,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creator: { id: 'user-1', displayName: 'Alice', avatar: null },
  };

  beforeEach(async () => {
    commentService = {
      create: jest.fn(),
      findByResource: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getAttachmentPreviewUrls: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        { provide: CommentService, useValue: commentService },
      ],
    }).compile();

    controller = module.get<CommentController>(CommentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/comments', () => {
    it('should call service.create with user sub and DTO', async () => {
      const dto: CreateCommentDto = {
        content: 'Great work!',
        resourceType: 'task',
        resourceId: 'resource-1',
      };
      commentService.create.mockResolvedValue(mockComment);

      const result = await controller.create(mockCurrentUser, dto);

      expect(commentService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockComment);
    });
  });

  describe('GET /api/v1/comments', () => {
    it('should call service.findByResource with query params', async () => {
      const paginatedResult = {
        data: [mockComment],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
      commentService.findByResource.mockResolvedValue(paginatedResult);

      const result = await controller.findByResource('task', 'resource-1', '1', '20');

      expect(commentService.findByResource).toHaveBeenCalledWith('task', 'resource-1', 1, 20);
      expect(result).toEqual(paginatedResult);
    });

    it('should pass undefined for page/pageSize when not provided', async () => {
      commentService.findByResource.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });

      await controller.findByResource('task', 'resource-1');

      expect(commentService.findByResource).toHaveBeenCalledWith('task', 'resource-1', undefined, undefined);
    });
  });

  describe('PATCH /api/v1/comments/:commentId', () => {
    it('should call service.update with commentId, user sub, and DTO', async () => {
      const dto: UpdateCommentDto = { content: 'Updated content' };
      const updatedComment = { ...mockComment, content: 'Updated content', isEdited: true };
      commentService.update.mockResolvedValue(updatedComment);

      const result = await controller.update('comment-1', mockCurrentUser, dto);

      expect(commentService.update).toHaveBeenCalledWith('comment-1', 'user-1', dto);
      expect(result.content).toBe('Updated content');
      expect(result.isEdited).toBe(true);
    });
  });

  describe('DELETE /api/v1/comments/:commentId', () => {
    it('should call service.delete with commentId and user sub', async () => {
      commentService.delete.mockResolvedValue(undefined);

      await controller.delete('comment-1', mockCurrentUser);

      expect(commentService.delete).toHaveBeenCalledWith('comment-1', 'user-1');
    });
  });

  describe('GET /api/v1/comments/attachment-preview', () => {
    it('should call service.getAttachmentPreviewUrls with parsed file IDs', async () => {
      commentService.getAttachmentPreviewUrls.mockResolvedValue({
        'file-1': '/preview/url/file-1',
        'file-2': '/preview/url/file-2',
      });

      const result = await controller.getAttachmentPreviewUrls('file-1,file-2');

      expect(commentService.getAttachmentPreviewUrls).toHaveBeenCalledWith(['file-1', 'file-2']);
      expect(result['file-1']).toBeDefined();
      expect(result['file-2']).toBeDefined();
    });
  });
});
