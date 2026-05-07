import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    phone: null,
    displayName: 'Test User',
    avatar: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── getProfile ────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return the user profile when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          displayName: true,
        }),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateProfile ─────────────────────────────────────────

  describe('updateProfile', () => {
    it('should update and return the profile', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        displayName: 'Updated Name',
      });

      const result = await service.updateProfile('user-1', {
        displayName: 'Updated Name',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { displayName: 'Updated Name' },
        select: expect.any(Object),
      });
      expect(result.displayName).toBe('Updated Name');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent-id', { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should only update provided fields', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, phone: '+1234567890' });

      const result = await service.updateProfile('user-1', {
        phone: '+1234567890',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { phone: '+1234567890' },
        select: expect.any(Object),
      });
      expect(result.phone).toBe('+1234567890');
    });
  });
});
