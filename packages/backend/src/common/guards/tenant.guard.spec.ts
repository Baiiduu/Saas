import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TENANT_OPTIONAL_KEY } from '../decorators/tenant-optional.decorator';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantMember: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) => {
        if (key === IS_PUBLIC_KEY) {
          return false;
        }
        if (key === TENANT_OPTIONAL_KEY) {
          return false;
        }
        return undefined;
      }),
    };
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
      },
    };

    guard = new TenantGuard(
      reflector as unknown as Reflector,
      prisma as any,
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

  it('allows public routes without tenant lookup', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createMockContext({ headers: {} }))).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('attaches tenantId from request header when no authenticated user exists', async () => {
    const request: any = { headers: { 'x-tenant-id': 'tenant-abc' } };

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(true);
    expect(request.tenantId).toBe('tenant-abc');
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('rejects authenticated protected routes without tenant header', async () => {
    const request: any = {
      headers: {},
      user: { sub: 'user-1', role: 'member' },
    };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(
      new BadRequestException('X-Tenant-Id header is required'),
    );
  });

  it('allows authenticated tenant-optional routes without tenant header', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === TENANT_OPTIONAL_KEY) {
        return true;
      }
      return undefined;
    });

    const request: any = {
      headers: {},
      user: { sub: 'user-1', role: 'member' },
    };

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('hydrates current tenant role for authenticated tenant members', async () => {
    const request: any = {
      headers: { 'x-tenant-id': 'tenant-abc' },
      user: { sub: 'user-1', role: 'member' },
    };

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-abc',
      status: 'active',
      deletedAt: null,
    });
    prisma.tenantMember.findUnique.mockResolvedValue({ role: 'admin' });

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(true);
    expect(request.tenantId).toBe('tenant-abc');
    expect(request.currentTenantRole).toBe('admin');
    expect(request.user.role).toBe('admin');
  });

  it('rejects missing tenants', async () => {
    const request: any = {
      headers: { 'x-tenant-id': 'tenant-missing' },
      user: { sub: 'user-1', role: 'member' },
    };
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(
      new NotFoundException('Tenant not found'),
    );
  });

  it('rejects users outside the current tenant', async () => {
    const request: any = {
      headers: { 'x-tenant-id': 'tenant-abc' },
      user: { sub: 'user-1', role: 'member' },
    };
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-abc',
      status: 'active',
      deletedAt: null,
    });
    prisma.tenantMember.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(
      new ForbiddenException('You are not a member of the current tenant'),
    );
  });
});
