import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto, SharePermission } from './dto/share-document.dto';

describe('DocumentService', () => {
  let service: DocumentService;
  let prisma: any;
  let storage: any;

  const mockCreator = { id: 'user-1', displayName: 'Alice', avatar: null };

  beforeAll(async () => {
    prisma = {
      document: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      docVersion: { create: jest.fn() },
      docShare: { create: jest.fn(), findUnique: jest.fn() },
    };
    storage = { upload: jest.fn(), delete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFolder', () => {
    const dto: CreateDocumentDto = { name: 'F', type: 'FOLDER' as const, teamId: 't1' };

    it('should create folder without parent', async () => {
      prisma.document.create.mockResolvedValue({ id: 'f1', name: 'F', type: 'FOLDER', parentId: null, teamId: 't1', creatorId: 'u1', creator: mockCreator, _count: { children: 0 } });
      const r = await service.createFolder('u1', dto);
      expect(r.id).toBe('f1');
    });

    it('should create folder with valid parent', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'p1', type: 'FOLDER', deletedAt: null });
      prisma.document.create.mockResolvedValue({ id: 'f2', type: 'FOLDER', parentId: 'p1', creator: mockCreator, _count: { children: 0 } });
      const r = await service.createFolder('u1', { ...dto, parentId: 'p1' });
      expect(r.parentId).toBe('p1');
    });

    it('should throw NotFoundException when parent missing', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.createFolder('u1', { ...dto, parentId: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when parent is file', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'f', type: 'FILE', deletedAt: null });
      await expect(service.createFolder('u1', { ...dto, parentId: 'f' })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when parent deleted', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd', type: 'FOLDER', deletedAt: new Date() });
      await expect(service.createFolder('u1', { ...dto, parentId: 'd' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadFile', () => {
    const dto: CreateDocumentDto = { name: 'r.pdf', type: 'FILE' as const, teamId: 't1', parentId: 'f1' };
    const file = { buffer: Buffer.from('x'), originalname: 'r.pdf', mimetype: 'application/pdf', size: 100 };

    it('should upload and create doc+version', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'f1', type: 'FOLDER', deletedAt: null });
      storage.upload.mockResolvedValue({ url: '/u/x', size: 100, mimetype: 'application/pdf', filename: 'x' });
      prisma.document.create.mockResolvedValue({ id: 'd1', name: 'r.pdf', type: 'FILE', fileUrl: '/u/x', fileSize: 100, mimeType: 'application/pdf' });
      prisma.docVersion.create.mockResolvedValue({ id: 'v1' });

      const r = await service.uploadFile('u1', file, dto);
      expect(r.id).toBe('d1');
      expect(storage.upload).toHaveBeenCalled();
      expect(prisma.docVersion.create).toHaveBeenCalled();
    });

    it('should throw on missing file', async () => {
      await expect(service.uploadFile('u1', null as any, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw on missing parent', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.uploadFile('u1', file, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw when parent is a FILE type', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'f1', type: 'FILE', deletedAt: null });
      await expect(service.uploadFile('u1', file, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw when parent is soft-deleted', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'f1', type: 'FOLDER', deletedAt: new Date() });
      await expect(service.uploadFile('u1', file, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTree', () => {
    it('should return nested tree', async () => {
      const root = { id: 'f1', type: 'FOLDER', name: 'Root', creator: mockCreator, _count: { children: 1 } };
      const child = { id: 'c1', type: 'FOLDER', name: 'Child', parentId: 'f1', creator: mockCreator, _count: { children: 0 } };
      prisma.document.findMany.mockResolvedValueOnce([root]).mockResolvedValueOnce([child]);

      const r = await service.getTree('t1');
      expect(r).toHaveLength(1);
      expect(r[0].children).toHaveLength(1);
    });

    it('should return flat for specific parentId', async () => {
      prisma.document.findMany.mockResolvedValue([{ id: 'x', type: 'FILE' }]);
      const r = await service.getTree('t1', 'p1');
      expect(r[0].children).toBeUndefined();
    });

    it('should return empty', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      const r = await service.getTree('t1');
      expect(r).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return doc', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1' });
      const r = await service.findById('d1');
      expect(r.id).toBe('d1');
    });

    it('should throw on missing', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });

    it('should throw on deleted', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', deletedAt: new Date() });
      await expect(service.findById('d1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const owned = { id: 'd1', type: 'FILE', fileUrl: '/u/x', creatorId: 'u1', deletedAt: null };

    it('should update name', async () => {
      prisma.document.findUnique.mockResolvedValue(owned);
      prisma.document.update.mockResolvedValue({ id: 'd1', name: 'New' });
      const r = await service.update('d1', 'u1', { name: 'New' });
      expect(r.name).toBe('New');
    });

    it('should update parentId', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(owned).mockResolvedValueOnce({ id: 'p1', type: 'FOLDER', deletedAt: null });
      prisma.document.update.mockResolvedValue({ id: 'd1', parentId: 'p1' });
      const r = await service.update('d1', 'u1', { parentId: 'p1' });
      expect(r.parentId).toBe('p1');
    });

    it('should set parentId to null', async () => {
      prisma.document.findUnique.mockResolvedValue(owned);
      prisma.document.update.mockResolvedValue({ id: 'd1', parentId: null });
      const r = await service.update('d1', 'u1', { parentId: null });
      expect(r.parentId).toBeNull();
    });

    it('should throw on missing doc', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.update('x', 'u1', { name: 'n' })).rejects.toThrow(NotFoundException);
    });

    it('should throw on wrong owner', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...owned, creatorId: 'other' });
      await expect(service.update('d1', 'u2', { name: 'n' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw on bad parent', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(owned).mockResolvedValueOnce(null);
      await expect(service.update('d1', 'u1', { parentId: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    const file = { id: 'd1', type: 'FILE', fileUrl: '/u/x.pdf', creatorId: 'u1', deletedAt: null };
    const folder = { id: 'f1', type: 'FOLDER', fileUrl: null, creatorId: 'u1', deletedAt: null };

    it('should soft-delete file and call storage.delete', async () => {
      prisma.document.findUnique.mockResolvedValue(file);
      storage.delete.mockResolvedValue(undefined);
      prisma.document.update.mockResolvedValue({ deletedAt: new Date() });

      await service.delete('d1', 'u1');
      expect(storage.delete).toHaveBeenCalledWith('x.pdf');
    });

    it('should soft-delete folder and children', async () => {
      prisma.document.findUnique.mockResolvedValue(folder);
      prisma.document.findMany.mockResolvedValue([{ id: 'c1', type: 'FILE', fileUrl: '/u/c.pdf' }]);
      prisma.document.update.mockResolvedValue({ deletedAt: new Date() });

      await service.delete('f1', 'u1');
      expect(storage.delete).toHaveBeenCalledWith('c.pdf');
    });

    it('should throw on missing', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.delete('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw on wrong owner', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...file, creatorId: 'other' });
      await expect(service.delete('d1', 'u2')).rejects.toThrow(ForbiddenException);
    });

    it('should not throw on storage failure', async () => {
      prisma.document.findUnique.mockResolvedValue(file);
      storage.delete.mockRejectedValue(new Error('fail'));
      prisma.document.update.mockResolvedValue({ deletedAt: new Date() });
      await expect(service.delete('d1', 'u1')).resolves.not.toThrow();
    });
  });

  describe('createShare', () => {
    const dto: ShareDocumentDto = { permission: SharePermission.VIEW };
    const ownedDoc = { id: 'd1', type: 'FILE', fileUrl: '/u/x', creatorId: 'u1', deletedAt: null };

    it('should create share link', async () => {
      prisma.document.findUnique.mockResolvedValue(ownedDoc);
      prisma.docShare.create.mockResolvedValue({ id: 's1', shareToken: 'tok', document: { name: 'r.pdf' } });

      const r = await service.createShare('d1', 'u1', dto);
      expect(r.document.name).toBe('r.pdf');
    });

    it('should support access code and expiry', async () => {
      prisma.document.findUnique.mockResolvedValue(ownedDoc);
      prisma.docShare.create.mockResolvedValue({ permission: 'edit', document: { name: 'r.pdf' } });

      const r = await service.createShare('d1', 'u1', { permission: SharePermission.EDIT, accessCode: 's', expiresAt: '2026-12-31T23:59:59Z' });
      expect(r.permission).toBe('edit');
    });

    it('should throw on missing doc', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.createShare('x', 'u1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw on deleted doc', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', creatorId: 'u1', deletedAt: new Date() });
      await expect(service.createShare('d1', 'u1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw when not the owner', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', creatorId: 'other', deletedAt: null });
      await expect(service.createShare('d1', 'u1', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('saveContent', () => {
    const ownedDoc = { id: 'd1', type: 'FILE', fileUrl: '/u/x', creatorId: 'u1', deletedAt: null };
    const updInclude = { include: { creator: { select: { id: true, displayName: true, avatar: true } } } };

    it('should save content for owned document', async () => {
      prisma.document.findUnique.mockResolvedValue(ownedDoc);
      prisma.document.update.mockResolvedValue({ id: 'd1', content: '<p>hi</p>', creator: mockCreator });

      const r = await service.saveContent('d1', 'u1', '<p>hi</p>');
      expect(r.content).toBe('<p>hi</p>');
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { content: '<p>hi</p>' },
        ...updInclude,
      });
    });

    it('should throw on missing doc', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.saveContent('x', 'u1', 'content')).rejects.toThrow(NotFoundException);
    });

    it('should throw on wrong owner', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...ownedDoc, creatorId: 'other' });
      await expect(service.saveContent('d1', 'u2', 'content')).rejects.toThrow(ForbiddenException);
    });

    it('should throw on deleted doc', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...ownedDoc, deletedAt: new Date() });
      await expect(service.saveContent('d1', 'u1', 'content')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getContent', () => {
    it('should return content for existing document', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'd1', name: 'doc', content: '<p>hello</p>', type: 'FILE', creatorId: 'u1', updatedAt: new Date(), deletedAt: null });
      const r = await service.getContent('d1');
      expect(r.content).toBe('<p>hello</p>');
    });

    it('should throw on missing doc', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.getContent('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('preview', () => {
    const baseDoc = { id: 'd1', name: 'r.pdf', type: 'FILE', content: null, fileUrl: '/u/x.pdf', fileSize: 100, mimeType: 'application/pdf', parentId: null, teamId: 't1', creatorId: 'u1', createdAt: new Date(), updatedAt: new Date(), deletedAt: null, creator: mockCreator, _count: { children: 0 } };

    it('should return preview with pdf type', async () => {
      prisma.document.findUnique.mockResolvedValue(baseDoc);
      const r = await service.preview('d1');
      expect(r.previewType).toBe('pdf');
      expect(r.fileUrl).toBe('/u/x.pdf');
    });

    it('should return image preview type', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...baseDoc, mimeType: 'image/png' });
      const r = await service.preview('d1');
      expect(r.previewType).toBe('image');
    });

    it('should return office preview type', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...baseDoc, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const r = await service.preview('d1');
      expect(r.previewType).toBe('office');
    });

    it('should return text preview type', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...baseDoc, mimeType: 'text/plain' });
      const r = await service.preview('d1');
      expect(r.previewType).toBe('text');
    });

    it('should return unknown for other mime types', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...baseDoc, mimeType: 'application/octet-stream' });
      const r = await service.preview('d1');
      expect(r.previewType).toBe('unknown');
    });

    it('should throw BadRequest for folder', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...baseDoc, type: 'FOLDER' });
      await expect(service.preview('d1')).rejects.toThrow(BadRequestException);
    });

    it('should throw on missing doc', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.preview('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getShareInfo', () => {
    const share = { id: 's1', shareToken: 't1', permission: 'view', accessCode: null, expiresAt: null, document: { id: 'd1', name: 'r.pdf', creator: null } };

    it('should return doc info via token', async () => {
      prisma.docShare.findUnique.mockResolvedValue(share);
      const r = await service.getShareInfo('t1');
      expect(r.document.id).toBe('d1');
    });

    it('should throw on bad token', async () => {
      prisma.docShare.findUnique.mockResolvedValue(null);
      await expect(service.getShareInfo('bad')).rejects.toThrow(NotFoundException);
    });

    it('should throw on expired', async () => {
      prisma.docShare.findUnique.mockResolvedValue({ ...share, expiresAt: new Date('2020-01-01') });
      await expect(service.getShareInfo('t1')).rejects.toThrow(BadRequestException);
    });

    it('should require access code', async () => {
      prisma.docShare.findUnique.mockResolvedValue({ ...share, accessCode: 's' });
      await expect(service.getShareInfo('t1')).rejects.toThrow(BadRequestException);
    });

    it('should validate access code', async () => {
      prisma.docShare.findUnique.mockResolvedValue({ ...share, accessCode: 's' });
      await expect(service.getShareInfo('t1', 'wrong')).rejects.toThrow(BadRequestException);
      const r = await service.getShareInfo('t1', 's');
      expect(r.document.id).toBe('d1');
    });
  });
});
