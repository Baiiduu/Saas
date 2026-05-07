import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let tokenBlacklistService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    phone: null,
    displayName: 'Test User',
    passwordHash: '',
    status: 'PENDING',
    activationCode: '123456',
    loginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.expiration': '15m',
          'jwt.refreshExpiration': '7d',
        };
        return map[key] ?? defaultValue;
      }),
    };

    tokenBlacklistService = {
      add: jest.fn().mockResolvedValue(undefined),
      isBlacklisted: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: TokenBlacklistService, useValue: tokenBlacklistService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── register ──────────────────────────────────────────────

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'new@example.com',
      displayName: 'New User',
      password: 'StrongPass1',
    };

    it('should create a new user with PENDING status and return activation code', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 'user-2',
        email: dto.email,
        displayName: dto.displayName,
      });

      const result = await service.register(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            displayName: dto.displayName,
            status: 'PENDING',
            activationCode: expect.any(String),
          }),
        }),
      );
      expect(result.status).toBe('PENDING');
      expect(result.activationCode).toMatch(/^\d{6}$/);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ── activate ──────────────────────────────────────────────

  describe('activate', () => {
    const dto: ActivateDto = {
      email: 'test@example.com',
      code: '123456',
    };

    it('should activate the user when code is correct', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, status: 'ACTIVE', activationCode: null });

      const result = await service.activate(dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: { status: 'ACTIVE', activationCode: null },
        }),
      );
      expect(result.message).toBe('Account activated successfully');
    });

    it('should throw BadRequestException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.activate(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when account is already active', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'ACTIVE' });

      await expect(service.activate(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when activation code is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.activate({ ...dto, code: '000000' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── login ─────────────────────────────────────────────────

  describe('login', () => {
    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'CorrectPass1',
    };

    beforeEach(() => {
      // Set a properly hashed password
      mockUser.passwordHash = bcrypt.hashSync('CorrectPass1', 10);
      mockUser.status = 'ACTIVE';
    });

    it('should return tokens for valid credentials with active account', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe(mockUser.email);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      await expect(service.login({ ...dto, password: 'WrongPass1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when account is PENDING', async () => {
      const pendingUser = { ...mockUser, status: 'PENDING' };
      prisma.user.findUnique.mockResolvedValue(pendingUser);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      };
      prisma.user.findUnique.mockResolvedValue(lockedUser);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should lock account after max failed attempts', async () => {
      const userWithAttempts = {
        ...mockUser,
        loginAttempts: 4,
      };
      prisma.user.findUnique.mockResolvedValue(userWithAttempts);
      prisma.user.update.mockResolvedValue(userWithAttempts);

      await expect(service.login({ ...dto, password: 'WrongPass1' })).rejects.toThrow(
        UnauthorizedException,
      );

      // The 5th failed attempt should set lockedUntil
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.lockedUntil).toBeDefined();
      expect(updateCall.data.loginAttempts).toBe(5);
    });
  });

  // ── logout ────────────────────────────────────────────────

  describe('logout', () => {
    it('should blacklist the refresh token jti', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'token-jti', type: 'refresh' });

      await service.logout('some-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('some-refresh-token');
      expect(tokenBlacklistService.add).toHaveBeenCalledWith('token-jti', expect.any(Number));
    });

    it('should not throw when token is invalid (already expired)', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
    });
  });

  // ── refresh ───────────────────────────────────────────────

  describe('refresh', () => {
    it('should return new tokens for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
        jti: 'token-jti',
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('should throw UnauthorizedException when token is not of type "refresh"', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        type: 'access',
        jti: 'token-jti',
      });

      await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
        jti: 'revoked-jti',
      });
      tokenBlacklistService.isBlacklisted.mockResolvedValue(true);

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is no longer active', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
        jti: 'token-jti',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'DISABLED' });

      await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token signature is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
