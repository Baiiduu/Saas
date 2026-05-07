import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: { verifyAsync: jest.Mock };
  let mockReflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    mockJwtService = { verifyAsync: jest.fn() };
    mockReflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(mockJwtService as any, mockReflector as any);
  });

  function createMockContext(request: any): any {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  }

  describe('public routes', () => {
    it('should allow access when @Public() decorator is present', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockContext({ headers: {} });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  describe('token validation', () => {
    it('should allow access with a valid Bearer token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'admin' });

      const request = { headers: { authorization: 'Bearer valid.jwt.token' } };
      const context = createMockContext(request);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
      expect((request as any).user).toEqual({ sub: 'user-1', role: 'admin' });
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockContext({ headers: {} });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication token is required'),
      );
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      const request = { headers: { authorization: 'Bearer bad.token' } };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authentication token'),
      );
    });

    it('should throw UnauthorizedException when Authorization header is malformed', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockContext({
        headers: { authorization: 'Basic somecreds' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication token is required'),
      );
    });
  });
});
