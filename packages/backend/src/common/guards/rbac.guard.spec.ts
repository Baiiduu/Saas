import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@saas/shared-types';
import { RbacGuard } from './rbac.guard';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let rbacService: { hasTenantRole: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    rbacService = { hasTenantRole: jest.fn() };
    guard = new RbacGuard(
      reflector as unknown as Reflector,
      rbacService as any,
    );
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

  it('allows access when no @RBAC decorator is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(createMockContext({ user: { sub: 'u1', role: Role.MEMBER } })),
    ).resolves.toBe(true);
  });

  it('allows token-role fallback when no tenant context is present', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    await expect(
      guard.canActivate(createMockContext({ user: { sub: 'u1', role: Role.OWNER } })),
    ).resolves.toBe(true);
    expect(rbacService.hasTenantRole).not.toHaveBeenCalled();
  });

  it('delegates tenant-aware role checks to RbacService', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    rbacService.hasTenantRole.mockResolvedValue(true);

    const request = {
      user: { sub: 'u1', role: Role.MEMBER },
      tenantId: 'tenant-1',
      params: { teamId: 'team-1' },
    };

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(true);
    expect(rbacService.hasTenantRole).toHaveBeenCalledWith(
      'u1',
      'tenant-1',
      [Role.ADMIN],
      'team-1',
    );
  });

  it('rejects authenticated users without sufficient tenant role', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    rbacService.hasTenantRole.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        createMockContext({
          user: { sub: 'u1', role: Role.MEMBER },
          tenantId: 'tenant-1',
        }),
      ),
    ).rejects.toThrow(new ForbiddenException('Insufficient permissions'));
  });

  it('rejects requests without an authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    await expect(guard.canActivate(createMockContext({}))).rejects.toThrow(
      new ForbiddenException('Authentication required for this resource'),
    );
  });
});
