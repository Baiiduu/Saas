import { ExecutionContext } from '@nestjs/common';
import { getCurrentTenant } from './current-tenant.decorator';

describe('CurrentTenant decorator', () => {
  function createMockContext(tenantId?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ tenantId }),
      }),
    } as ExecutionContext;
  }

  it('should return the tenantId when it is set on the request', () => {
    const result = getCurrentTenant(undefined, createMockContext('tenant-abc'));
    expect(result).toBe('tenant-abc');
  });

  it('should return undefined when tenantId is not set on the request', () => {
    const result = getCurrentTenant(undefined, createMockContext(undefined));
    expect(result).toBeUndefined();
  });
});
