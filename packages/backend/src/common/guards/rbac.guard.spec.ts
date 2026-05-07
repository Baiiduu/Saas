import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@saas/shared-types';
import { RbacGuard } from './rbac.guard';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    mockReflector = { getAllAndOverride: jest.fn() };
    guard = new RbacGuard(mockReflector as any);
    // Ensure non-strict mode for most tests
    delete process.env.STRICT_RBAC_GUARD;
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

  // ── No @RBAC() decorator ──────────────────────────────

  describe('no @RBAC() decorator', () => {
    it('should allow access when no roles are required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createMockContext({ user: { sub: 'u1', role: Role.MEMBER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when empty roles array', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.MEMBER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // ── @RBAC() with matching role ────────────────────────

  describe('@RBAC() with matching role', () => {
    it('should allow when user has one of the required roles (exact match)', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.ADMIN } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow when user has a higher role than required (hierarchy)', () => {
      // OWNER (100) >= ADMIN (80)
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.OWNER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow when user has a role among multiple required using hierarchy', () => {
      // OWNER (100) >= min(LEADER(60), ADMIN(80)) = 60
      mockReflector.getAllAndOverride.mockReturnValue([Role.LEADER, Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.OWNER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // ── @RBAC() with insufficient role ────────────────────

  describe('@RBAC() with insufficient role (non-strict mode)', () => {
    it('should pass through in non-strict mode when user role is insufficient', () => {
      // MEMBER (40) < ADMIN (80) — but non-strict falls through
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.MEMBER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should pass through in non-strict mode when user has no role field', () => {
      // No role field on user object → no synchronous check → falls through
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1' } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // ── Strict mode ───────────────────────────────────────

  describe('strict mode (STRICT_RBAC_GUARD=true)', () => {
    beforeEach(() => {
      process.env.STRICT_RBAC_GUARD = 'true';
    });

    afterEach(() => {
      delete process.env.STRICT_RBAC_GUARD;
    });

    it('should allow when user has sufficient role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.ADMIN } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow when user has higher role via hierarchy', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.OWNER } });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks sufficient role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1', role: Role.MEMBER } });
      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Insufficient permissions'),
      );
    });

    it('should throw ForbiddenException when user has no role field', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: { sub: 'u1' } });
      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Insufficient permissions'),
      );
    });
  });

  // ── Missing user ──────────────────────────────────────

  describe('missing user', () => {
    it('should throw ForbiddenException when user is missing from request', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({});
      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required for this resource'),
      );
    });

    it('should throw ForbiddenException when user is null', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const context = createMockContext({ user: null });
      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required for this resource'),
      );
    });
  });
});
