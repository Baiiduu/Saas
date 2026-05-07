import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock fs completely
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn(),
}));

import * as fs from 'fs';

describe('StorageService', () => {
  let service: StorageService;
  let configService: any;

  const mockFile = {
    buffer: Buffer.from('file content'),
    originalname: 'test-image.png',
    mimetype: 'image/png',
    size: 1024,
  };

  beforeEach(async () => {
    // Reset NODE_ENV to dev for each test
    process.env.NODE_ENV = 'development';

    configService = {
      get: jest.fn().mockReturnValue({}),
    };

    // Clear all fs mock calls before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── upload ──────────────────────────────────────────────────

  describe('upload', () => {
    it('should upload a valid file and return metadata', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const result = await service.upload(mockFile);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(result.mimetype).toBe('image/png');
      expect(result.size).toBe(1024);
      expect(result.filename).toMatch(/^[0-9a-f-]+\.png$/);
      expect(result.url).toMatch(/^\/api\/v1\/storage\//);
    });

    it('should reject file with disallowed MIME type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/x-msdownload',
        originalname: 'virus.exe',
      };

      await expect(service.upload(invalidFile)).rejects.toThrow(BadRequestException);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should reject oversized file', async () => {
      const oversizedFile = {
        ...mockFile,
        size: 60 * 1024 * 1024, // 60 MB
      };

      await expect(service.upload(oversizedFile)).rejects.toThrow(BadRequestException);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should accept file exactly at max size limit', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      const maxSizeFile = {
        ...mockFile,
        size: 50 * 1024 * 1024, // exactly 50 MB
      };

      const result = await service.upload(maxSizeFile);

      expect(result.size).toBe(50 * 1024 * 1024);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle files without extension', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      const noExtFile = {
        ...mockFile,
        originalname: 'README',
        mimetype: 'text/plain',
      };

      const result = await service.upload(noExtFile);

      expect(result.filename).toMatch(/^[0-9a-f-]+\.bin$/);
    });

    it('should accept various allowed MIME types', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      const allowedTypes = [
        { mimetype: 'image/jpeg', ext: '.jpg' },
        { mimetype: 'image/gif', ext: '.gif' },
        { mimetype: 'image/webp', ext: '.webp' },
        { mimetype: 'image/svg+xml', ext: '.svg' },
        { mimetype: 'application/pdf', ext: '.pdf' },
        { mimetype: 'application/msword', ext: '.doc' },
        { mimetype: 'text/plain', ext: '.txt' },
        { mimetype: 'text/markdown', ext: '.md' },
        { mimetype: 'text/csv', ext: '.csv' },
      ];

      for (const t of allowedTypes) {
        const file = { ...mockFile, mimetype: t.mimetype, originalname: `test${t.ext}` };
        const result = await service.upload(file);
        expect(result.mimetype).toBe(t.mimetype);
      }
    });
  });

  // ── getDownloadUrl ──────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('should return local file path when file exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getDownloadUrl('existing-file.png');

      expect(result).toContain('uploads');
      expect(result).toContain('existing-file.png');
    });

    it('should throw NotFoundException when file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        service.getDownloadUrl('nonexistent.png'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete an existing file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

      await service.delete('existing-file.png');

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('existing-file.png'),
      );
    });

    it('should throw NotFoundException when file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        service.delete('nonexistent.png'),
      ).rejects.toThrow(NotFoundException);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  // ── getLocalFilePath ────────────────────────────────────────

  describe('getLocalFilePath', () => {
    it('should return the full path for a given filename', () => {
      const result = service.getLocalFilePath('some-file.pdf');

      expect(result).toContain('uploads');
      expect(result).toContain('some-file.pdf');
    });
  });
});
