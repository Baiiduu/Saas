import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@saas/shared-types';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

describe('RbacController', () => {
  let controller: RbacController;
  let rbacService: any;

  const mockUser = { sub: 'user-1' };
  const mockAdmin = { sub: 'admin-1' };
  const mockOwner = { sub: 'owner-1' };

  beforeEach(async () => {
    rbacService = {
      checkPermission: jest.fn(),
      getUserHighestRole: jest.fn(),
      getUserTenantRole: jest.fn(),
      getRoleLevel: jest.fn(),
      requireRole: jest.fn(),
      assignRole: jest.fn(),
      getRoleDefinitions: jest.fn(),
      getUserEffectivePermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [
        { provide: RbacService, useValue: rbacService },
      ],
    }).compile();

    controller = module.get<RbacController>(RbacController);
  });

  // ── POST /rbac/check ───────────────────────────────────

  describe('checkPermission', () => {
    it('should return allowed=true when service returns true', async () => {
      rbacService.checkPermission.mockResolvedValue(true);

      const result = await controller.checkPermission(
        { user: mockUser },
        { resourceType: 'task', operation: 'read' },
      );

      expect(result).toEqual({ allowed: true });
      expect(rbacService.checkPermission).toHaveBeenCalledWith(
        'user-1', 'task', 'read',
        { resourceId: undefined, teamId: undefined },
      );
    });

    it('should return allowed=false when service returns false', async () => {
      rbacService.checkPermission.mockResolvedValue(false);

      const result = await controller.checkPermission(
        { user: mockUser },
        { resourceType: 'task', operation: 'delete' },
      );

      expect(result).toEqual({ allowed: false });
    });

    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.checkPermission(
          { user: null },
          { resourceType: 'task', operation: 'read' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── GET /rbac/permissions/:userId ──────────────────────

  describe('getUserPermissions', () => {
    it('should allow self-service without role check', async () => {
      rbacService.getUserEffectivePermissions.mockResolvedValue({
        'task.read': true,
      });

      const result = await controller.getUserPermissions(
        { user: { sub: 'user-1' } },
        'user-1',
      );

      expect(result).toEqual({
        userId: 'user-1',
        permissions: { 'task.read': true },
      });
      // Should NOT call requireRole for self-service
      expect(rbacService.requireRole).not.toHaveBeenCalled();
    });

    it('should check ADMIN/OWNER for non-self requests', async () => {
      rbacService.getUserEffectivePermissions.mockResolvedValue({});

      await controller.getUserPermissions(
        { user: { sub: 'admin-1' } },
        'user-other',
      );

      expect(rbacService.requireRole).toHaveBeenCalledWith('admin-1', [
        Role.ADMIN,
        Role.OWNER,
      ]);
    });
  });

  // ── GET /rbac/roles ────────────────────────────────────

  describe('listRoles', () => {
    it('should return role definitions', async () => {
      const mockDefs = [
        { role: Role.OWNER, level: 100 },
        { role: Role.ADMIN, level: 80 },
      ];
      rbacService.getRoleDefinitions.mockReturnValue(mockDefs);

      const result = await controller.listRoles();

      expect(result).toEqual({
        roles: [
          { role: Role.OWNER, level: 100 },
          { role: Role.ADMIN, level: 80 },
        ],
      });
    });
  });

  // ── POST /rbac/users/:userId/role ──────────────────────

  describe('assignRole', () => {
    const dto = { role: Role.MEMBER };

    it('should assign a role successfully for an admin', async () => {
      rbacService.getUserHighestRole.mockResolvedValue(Role.ADMIN);
      rbacService.getUserTenantRole.mockResolvedValue(Role.MEMBER);
      rbacService.getRoleLevel.mockImplementation((r: Role) => {
        const levels: Record<string, number> = {
          [Role.OWNER]: 100,
          [Role.ADMIN]: 80,
          [Role.LEADER]: 60,
          [Role.MEMBER]: 40,
          [Role.READER]: 20,
          [Role.GUEST]: 10,
        };
        return levels[r] ?? 0;
      });

      const result = await controller.assignRole(
        { user: mockAdmin, tenantId: 'ten1' },
        'target-user',
        dto,
      );

      expect(result).toEqual({ message: 'Role MEMBER assigned successfully' });
      expect(rbacService.assignRole).toHaveBeenCalledWith(
        'target-user', Role.MEMBER, 'ten1', undefined,
      );
    });

    it('should block owner demotion by non-owner', async () => {
      rbacService.getUserHighestRole.mockResolvedValue(Role.ADMIN);
      // Target user is currently OWNER
      rbacService.getUserTenantRole.mockResolvedValue(Role.OWNER);

      await expect(
        controller.assignRole(
          { user: mockAdmin, tenantId: 'ten1' },
          'owner-user',
          dto,
        ),
      ).rejects.toThrow(
        new ForbiddenException('Only the tenant owner can change the role of an owner'),
      );

      expect(rbacService.assignRole).not.toHaveBeenCalled();
    });

    it('should allow owner to change another owner role', async () => {
      rbacService.getUserHighestRole.mockResolvedValue(Role.OWNER);
      rbacService.getUserTenantRole.mockResolvedValue(Role.OWNER);
      rbacService.getRoleLevel.mockImplementation((r: Role) => {
        const levels: Record<string, number> = {
          [Role.OWNER]: 100,
          [Role.ADMIN]: 80,
          [Role.LEADER]: 60,
          [Role.MEMBER]: 40,
          [Role.READER]: 20,
          [Role.GUEST]: 10,
        };
        return levels[r] ?? 0;
      });

      await controller.assignRole(
        { user: mockOwner, tenantId: 'ten1' },
        'other-owner',
        dto,
      );

      expect(rbacService.assignRole).toHaveBeenCalled();
    });

    it('should block assigning role higher than own level', async () => {
      rbacService.getUserHighestRole.mockResolvedValue(Role.MEMBER);
      rbacService.getUserTenantRole.mockResolvedValue(Role.MEMBER);
      rbacService.getRoleLevel.mockImplementation((r: Role) => {
        const levels: Record<string, number> = {
          [Role.OWNER]: 100,
          [Role.ADMIN]: 80,
          [Role.LEADER]: 60,
          [Role.MEMBER]: 40,
          [Role.READER]: 20,
          [Role.GUEST]: 10,
        };
        return levels[r] ?? 0;
      });

      await expect(
        controller.assignRole(
          { user: mockAdmin, tenantId: 'ten1' },
          'target-user',
          { role: Role.ADMIN },
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'You cannot assign a role with higher privileges than your own',
        ),
      );

      expect(rbacService.assignRole).not.toHaveBeenCalled();
    });

    it('should throw when tenantId is missing', async () => {
      rbacService.getUserHighestRole.mockResolvedValue(Role.ADMIN);
      rbacService.getUserTenantRole.mockResolvedValue(Role.MEMBER);
      rbacService.getRoleLevel.mockReturnValue(40);

      await expect(
        controller.assignRole(
          { user: mockAdmin, tenantId: undefined },
          'target-user',
          dto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
