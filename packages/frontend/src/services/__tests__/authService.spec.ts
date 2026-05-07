/**
 * @jest-environment node
 */

import { login } from '../authService';
import * as api from '../api';
import type { LoginResponse } from '@/types';
import { Role } from '@saas/shared-types';

jest.mock('../api', () => ({
  post: jest.fn(),
}));

const mockedPost = jest.mocked(api.post);

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginRequest = { email: 'test@example.com', password: 'Password1' };

    it('should return LoginResponse with role field when provided', async () => {
      const mockResponse: LoginResponse = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          displayName: 'Test User',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        tenant: {
          id: 'tenant-1',
          name: 'Test Tenant',
          ownerId: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        role: Role.ADMIN,
      };

      mockedPost.mockResolvedValue(mockResponse);

      const result = await login(loginRequest);

      expect(mockedPost).toHaveBeenCalledWith('/auth/login', loginRequest);
      expect(result).toHaveProperty('role');
      expect(result.role).toBe(Role.ADMIN);
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
    });

    it('should return LoginResponse without role field when not provided', async () => {
      const mockResponse: LoginResponse = {
        accessToken: 'access-token-789',
        refreshToken: 'refresh-token-000',
        user: {
          id: 'user-2',
          email: 'user2@example.com',
          displayName: 'User Two',
          status: 'active',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
        tenant: {
          id: 'tenant-2',
          name: 'Tenant Two',
          ownerId: 'user-2',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
      };

      mockedPost.mockResolvedValue(mockResponse);

      const result = await login(loginRequest);

      expect(result).not.toHaveProperty('role');
    });
  });
});
