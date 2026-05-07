jest.mock('fs', () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

describe('StorageController', () => {
  let controller: StorageController;
  let storageService: any;

  const mockUploadResponse = {
    filename: '550e8400-e29b-41d4-a716-446655440000.png',
    url: '/api/v1/storage/550e8400-e29b-41d4-a716-446655440000.png',
    mimetype: 'image/png',
    size: 1024,
  };

  beforeEach(async () => {
    storageService = {
      upload: jest.fn(),
      getDownloadUrl: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/storage/upload', () => {
    it('should call service.upload with the file and return result', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024,
      };
      storageService.upload.mockResolvedValue(mockUploadResponse);

      const result = await controller.upload(mockFile);

      expect(storageService.upload).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockUploadResponse);
    });
  });

  describe('GET /api/v1/storage/:filename', () => {
    it('should stream the file when it exists locally', async () => {
      const mockRes = {
        json: jest.fn(),
      };
      storageService.getDownloadUrl.mockResolvedValue('/fake/path/file.png');

      const fs = jest.requireMock('fs');
      const pipeMock = jest.fn();
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: pipeMock });

      await controller.download('file.png', mockRes as any);

      expect(storageService.getDownloadUrl).toHaveBeenCalledWith('file.png');
      expect(fs.createReadStream).toHaveBeenCalledWith('/fake/path/file.png');
      expect(pipeMock).toHaveBeenCalledWith(mockRes);
    });

    it('should return JSON URL when file is remote', async () => {
      const mockRes = {
        json: jest.fn(),
      };
      storageService.getDownloadUrl.mockResolvedValue('/api/v1/storage/remote-file.png');

      const fs = jest.requireMock('fs');
      fs.existsSync.mockReturnValue(false);

      await controller.download('remote-file.png', mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({
        url: '/api/v1/storage/remote-file.png',
      });
    });
  });

  describe('DELETE /api/v1/storage/:filename', () => {
    it('should call service.delete with the filename', async () => {
      storageService.delete.mockResolvedValue(undefined);

      await controller.delete('file-to-delete.png');

      expect(storageService.delete).toHaveBeenCalledWith('file-to-delete.png');
    });
  });
});
