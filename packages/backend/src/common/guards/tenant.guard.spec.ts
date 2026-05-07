import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
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

  it('should attach tenantId when X-Tenant-Id header is present', () => {
    const request = { headers: { 'x-tenant-id': 'tenant-abc' } };
    const context = createMockContext(request);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect((request as any).tenantId).toBe('tenant-abc');
  });

  it('should pass without X-Tenant-Id header (tenantId stays undefined)', () => {
    const request = { headers: {} };
    const context = createMockContext(request);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect((request as any).tenantId).toBeUndefined();
  });
});
