import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('should return the full user when no property key is given', () => {
    const mockUser = { sub: 'user-1', email: 'test@test.com', role: 'admin' };
    const result = getCurrentUser(undefined, createMockContext(mockUser));
    expect(result).toEqual(mockUser);
  });

  it('should extract a specific property when a key is provided', () => {
    const mockUser = { sub: 'user-1', email: 'test@test.com' };
    const result = getCurrentUser('sub', createMockContext(mockUser));
    expect(result).toBe('user-1');
  });

  it('should return undefined when user is not set on request', () => {
    const result = getCurrentUser(undefined, createMockContext(undefined));
    expect(result).toBeUndefined();
  });

  it('should return undefined for a missing property key', () => {
    const mockUser = { sub: 'user-1' };
    const result = getCurrentUser('nonexistent', createMockContext(mockUser));
    expect(result).toBeUndefined();
  });
});
