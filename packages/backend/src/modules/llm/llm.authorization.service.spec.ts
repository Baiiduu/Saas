import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { LlmAuthorizationService } from './llm.authorization.service';

describe('LlmAuthorizationService', () => {
  let service: LlmAuthorizationService;
  let prisma: {
    task: { findUnique: jest.Mock };
    document: { findUnique: jest.Mock };
    approval: { findUnique: jest.Mock };
    milestone: { findUnique: jest.Mock };
  };
  let rbacService: {
    canAccessPermission: jest.Mock;
    assertPermission: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      document: {
        findUnique: jest.fn(),
      },
      approval: {
        findUnique: jest.fn(),
      },
      milestone: {
        findUnique: jest.fn(),
      },
    };
    rbacService = {
      canAccessPermission: jest.fn(),
      assertPermission: jest.fn(),
    };

    service = new LlmAuthorizationService(
      prisma as unknown as PrismaService,
      rbacService as unknown as RbacService,
    );
  });

  it('delegates llm permission checks to unified rbac service', async () => {
    rbacService.canAccessPermission.mockResolvedValue(true);

    await expect(
      service.canAccessPermission('llm.read', 'user-1', 'tenant-1', 'team-1'),
    ).resolves.toBe(true);

    expect(rbacService.canAccessPermission).toHaveBeenCalledWith(
      'llm.read',
      'user-1',
      'tenant-1',
      { teamId: 'team-1' },
    );
  });

  it('bubbles assertion failures from the unified rbac service', async () => {
    rbacService.assertPermission.mockRejectedValue(
      new ForbiddenException('Cross-tenant team access is not allowed'),
    );

    await expect(
      service.assertPermission('llm.create', 'user-1', 'tenant-2', 'team-1'),
    ).rejects.toThrow(new ForbiddenException('Cross-tenant team access is not allowed'));
  });

  it('keeps AI resource authorization on the unified permission path', async () => {
    prisma.document.findUnique.mockResolvedValue({
      teamId: 'team-doc',
      deletedAt: null,
    });
    rbacService.assertPermission.mockResolvedValue(undefined);

    const decision = await service.authorizeToolExecution(
      {
        id: 'document.update_content',
        name: 'Update document',
        description: 'update',
        parameters: [],
        resourceType: 'document',
        requiredPermission: 'document.update',
        actionType: 'write',
        riskLevel: 'medium',
      },
      {
        toolId: 'document.update_content',
        args: { docId: 'doc-1' },
        userId: 'user-1',
        tenantId: 'tenant-1',
      },
    );

    expect(decision).toEqual({
      allowed: true,
      resourceId: 'doc-1',
      teamId: 'team-doc',
    });
    expect(rbacService.assertPermission).toHaveBeenCalledWith(
      'document.update',
      'user-1',
      'tenant-1',
      {
        teamId: 'team-doc',
        resourceId: 'doc-1',
        ownership: 'creator',
      },
    );
  });
});
