import { Test, TestingModule } from '@nestjs/testing';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentSearchService } from './document-search.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto, SharePermission } from './dto/share-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';

describe('DocumentController', () => {
  let controller: DocumentController;
  let documentService: any;
  let documentSearchService: any;

  const mockCurrentUser = {
    sub: 'user-1',
    email: 'user@example.com',
    type: 'access' as const,
  };

  const mockFolder = {
    id: 'folder-1',
    name: 'My Folder',
    type: 'FOLDER',
    content: null,
    fileUrl: null,
    fileSize: null,
    mimeType: null,
    parentId: null,
    teamId: 'team-1',
    creatorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creator: { id: 'user-1', displayName: 'Alice', avatar: null },
    _count: { children: 0 },
    children: [],
  };

  const mockFileDoc = {
    id: 'doc-1',
    name: 'report.pdf',
    type: 'FILE',
    content: null,
    fileUrl: '/api/v1/storage/file.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    parentId: 'folder-1',
    teamId: 'team-1',
    creatorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creator: { id: 'user-1', displayName: 'Alice', avatar: null },
  };

  const mockShare = {
    id: 'share-1',
    documentId: 'doc-1',
    shareToken: 'token-uuid',
    permission: 'view',
    accessCode: null,
    expiresAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    document: { id: 'doc-1', name: 'report.pdf', type: 'FILE' },
  };

  const mockFile = {
    buffer: Buffer.from('test'),
    originalname: 'report.pdf',
    mimetype: 'application/pdf',
    size: 1024,
  };

  beforeEach(async () => {
    documentService = {
      getTree: jest.fn(),
      createFolder: jest.fn(),
      uploadFile: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createShare: jest.fn(),
      getShareInfo: jest.fn(),
      saveContent: jest.fn(),
      getContent: jest.fn(),
      preview: jest.fn(),
    };

    documentSearchService = {
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        { provide: DocumentService, useValue: documentService },
        { provide: DocumentSearchService, useValue: documentSearchService },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/documents', () => {
    it('should call documentService.getTree with teamId and parentId', async () => {
      documentService.getTree.mockResolvedValue([mockFolder]);

      const result = await controller.list('team-1', 'folder-1');

      expect(documentService.getTree).toHaveBeenCalledWith('team-1', 'folder-1');
      expect(result).toEqual([mockFolder]);
    });

    it('should call documentService.getTree without parentId when omitted', async () => {
      documentService.getTree.mockResolvedValue([mockFolder]);

      await controller.list('team-1', undefined);

      expect(documentService.getTree).toHaveBeenCalledWith('team-1', undefined);
    });
  });

  describe('GET /api/v1/documents/search', () => {
    it('should call documentSearchService.search with teamId and query', async () => {
      const searchResult = [{ id: 'doc-1', name: 'report', rank: 0.5 }];
      documentSearchService.search.mockResolvedValue(searchResult);

      const dto: SearchDocumentDto = { q: 'report', teamId: 'team-1' };
      const result = await controller.search(dto);

      expect(documentSearchService.search).toHaveBeenCalledWith('team-1', 'report');
      expect(result).toEqual(searchResult);
    });
  });

  describe('POST /api/v1/documents (folder)', () => {
    it('should call documentService.createFolder when type is FOLDER', async () => {
      const dto: CreateDocumentDto = {
        name: 'My Folder',
        type: 'FOLDER',
        teamId: 'team-1',
      };
      documentService.createFolder.mockResolvedValue(mockFolder);

      const result = await controller.create(mockCurrentUser, dto);

      expect(documentService.createFolder).toHaveBeenCalledWith('user-1', dto);
      expect(documentService.uploadFile).not.toHaveBeenCalled();
      expect(result).toEqual(mockFolder);
    });
  });

  describe('POST /api/v1/documents (file)', () => {
    it('should call documentService.uploadFile when type is FILE', async () => {
      const dto: CreateDocumentDto = {
        name: 'report.pdf',
        type: 'FILE',
        teamId: 'team-1',
        parentId: 'folder-1',
      };
      documentService.uploadFile.mockResolvedValue(mockFileDoc);

      const result = await controller.create(mockCurrentUser, dto, mockFile);

      expect(documentService.uploadFile).toHaveBeenCalledWith('user-1', mockFile, dto);
      expect(documentService.createFolder).not.toHaveBeenCalled();
      expect(result).toEqual(mockFileDoc);
    });

    it('should pass undefined file when not provided', async () => {
      const dto: CreateDocumentDto = {
        name: 'report.pdf',
        type: 'FILE',
        teamId: 'team-1',
      };
      documentService.uploadFile.mockResolvedValue(mockFileDoc);

      await controller.create(mockCurrentUser, dto, undefined);

      expect(documentService.uploadFile).toHaveBeenCalledWith('user-1', undefined, dto);
    });
  });

  describe('GET /api/v1/documents/:docId', () => {
    it('should call documentService.findById with docId', async () => {
      documentService.findById.mockResolvedValue(mockFileDoc);

      const result = await controller.findById('doc-1');

      expect(documentService.findById).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual(mockFileDoc);
    });
  });

  describe('GET /api/v1/documents/:docId/preview', () => {
    it('should call documentService.preview with docId', async () => {
      const previewResult = { ...mockFileDoc, previewType: 'pdf' };
      documentService.preview.mockResolvedValue(previewResult);

      const result = await controller.preview('doc-1');

      expect(documentService.preview).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual(previewResult);
    });
  });

  describe('GET /api/v1/documents/:docId/content', () => {
    it('should call documentService.getContent with docId', async () => {
      const contentResult = { id: 'doc-1', name: 'report.pdf', content: '<p>hello</p>', updatedAt: new Date(), creatorId: 'user-1' };
      documentService.getContent.mockResolvedValue(contentResult);

      const result = await controller.getContent('doc-1');

      expect(documentService.getContent).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual(contentResult);
    });
  });

  describe('PATCH /api/v1/documents/:docId/content', () => {
    it('should call documentService.saveContent with docId, user sub, and content', async () => {
      const savedDoc = { ...mockFileDoc, content: '<p>updated</p>' };
      documentService.saveContent.mockResolvedValue(savedDoc);

      const result = await controller.saveContent('doc-1', mockCurrentUser, '<p>updated</p>');

      expect(documentService.saveContent).toHaveBeenCalledWith('doc-1', 'user-1', '<p>updated</p>');
      expect(result).toEqual(savedDoc);
    });
  });

  describe('PATCH /api/v1/documents/:docId', () => {
    it('should call documentService.update with docId, user sub, and body', async () => {
      const updateData = { name: 'Renamed.pdf', parentId: null };
      documentService.update.mockResolvedValue({ ...mockFileDoc, name: 'Renamed.pdf' });

      const result = await controller.update('doc-1', mockCurrentUser, updateData);

      expect(documentService.update).toHaveBeenCalledWith('doc-1', 'user-1', updateData);
      expect(result.name).toBe('Renamed.pdf');
    });
  });

  describe('DELETE /api/v1/documents/:docId', () => {
    it('should call documentService.delete with docId and user sub', async () => {
      documentService.delete.mockResolvedValue(undefined);

      await controller.delete('doc-1', mockCurrentUser);

      expect(documentService.delete).toHaveBeenCalledWith('doc-1', 'user-1');
    });
  });

  describe('POST /api/v1/documents/:docId/share', () => {
    it('should call documentService.createShare with docId, user sub, and DTO', async () => {
      const dto: ShareDocumentDto = {
        permission: SharePermission.VIEW,
      };
      documentService.createShare.mockResolvedValue(mockShare);

      const result = await controller.createShare('doc-1', mockCurrentUser, dto);

      expect(documentService.createShare).toHaveBeenCalledWith('doc-1', 'user-1', dto);
      expect(result).toEqual(mockShare);
    });
  });

  describe('GET /api/v1/documents/share/:shareToken', () => {
    it('should call documentService.getShareInfo with token and accessCode', async () => {
      const shareResult = { document: mockFileDoc, permission: 'view', expiresAt: null };
      documentService.getShareInfo.mockResolvedValue(shareResult);

      const result = await controller.getShareInfo('token-1', 'mycode');

      expect(documentService.getShareInfo).toHaveBeenCalledWith('token-1', 'mycode');
      expect(result).toEqual(shareResult);
    });

    it('should call documentService.getShareInfo without accessCode when omitted', async () => {
      documentService.getShareInfo.mockResolvedValue({ document: mockFileDoc, permission: 'view', expiresAt: null });

      await controller.getShareInfo('token-1');

      expect(documentService.getShareInfo).toHaveBeenCalledWith('token-1', undefined);
    });
  });
});
