import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService, ROLE_HIERARCHY } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: any;

  beforeAll(async () => {
    prisma = {
      tenantMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      teamMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      docShare: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      approvalTemplate: {
        findUnique: jest.fn(),
      },
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getRoleLevel ───────────────────────────────────────

  describe('getRoleLevel', () => {
    it('should return 100 for OWNER', () => {
      expect(service.getRoleLevel(Role.OWNER)).toBe(100);
    });

    it('should return 80 for ADMIN', () => {
      expect(service.getRoleLevel(Role.ADMIN)).toBe(80);
    });

    it('should return 60 for LEADER', () => {
      expect(service.getRoleLevel(Role.LEADER)).toBe(60);
    });

    it('should return 40 for MEMBER', () => {
      expect(service.getRoleLevel(Role.MEMBER)).toBe(40);
    });

    it('should return 20 for READER', () => {
      expect(service.getRoleLevel(Role.READER)).toBe(20);
    });

    it('should return 10 for GUEST', () => {
      expect(service.getRoleLevel(Role.GUEST)).toBe(10);
    });

    it('should return 0 for unknown value', () => {
      expect(service.getRoleLevel('UNKNOWN' as Role)).toBe(0);
    });
  });

  // ── getHighestRole (private, accessed via any) ─────────

  describe('getHighestRole', () => {
    it('should pick tenant role when no team roles', () => {
      const result = (service as any).getHighestRole({
        tenantRole: Role.ADMIN,
        teamRoles: [],
      });
      expect(result).toBe(Role.ADMIN);
    });

    it('should pick highest from tenant and team roles', () => {
      const result = (service as any).getHighestRole({
        tenantRole: Role.MEMBER,
        teamRoles: [
          { teamId: 't1', role: Role.LEADER },
          { teamId: 't2', role: Role.ADMIN },
        ],
      });
      // ADMIN (80) > LEADER (60) > MEMBER (40)
      expect(result).toBe(Role.ADMIN);
    });

    it('should return null when no roles exist', () => {
      const result = (service as any).getHighestRole({
        tenantRole: null,
        teamRoles: [],
      });
      expect(result).toBeNull();
    });

    it('should prefer OWNER over any other role', () => {
      const result = (service as any).getHighestRole({
        tenantRole: Role.OWNER,
        teamRoles: [{ teamId: 't1', role: Role.MEMBER }],
      });
      expect(result).toBe(Role.OWNER);
    });
  });

  // ── getUserHighestRole ─────────────────────────────────

  describe('getUserHighestRole', () => {
    it('should resolve highest role from tenant and team', async () => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.MEMBER, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.teamMember.findMany.mockResolvedValue([
        { teamId: 't1', userId: 'u1', role: Role.ADMIN },
      ]);

      const role = await service.getUserHighestRole('u1');
      expect(role).toBe(Role.ADMIN);
    });

    it('should return null when user has no memberships', async () => {
      prisma.tenantMember.findMany.mockResolvedValue([]);
      prisma.teamMember.findMany.mockResolvedValue([]);

      const role = await service.getUserHighestRole('u1');
      expect(role).toBeNull();
    });
  });

  // ── getUserTenantRole ──────────────────────────────────

  describe('getUserTenantRole', () => {
    it('should return the tenant role', async () => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.ADMIN, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      const role = await service.getUserTenantRole('u1');
      expect(role).toBe(Role.ADMIN);
    });

    it('should return null when no tenant membership', async () => {
      prisma.tenantMember.findMany.mockResolvedValue([]);
      const role = await service.getUserTenantRole('u1');
      expect(role).toBeNull();
    });
  });

  // ── getUserTeamRole ────────────────────────────────────

  describe('getUserTeamRole', () => {
    it('should return team role when direct membership exists', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({
        teamId: 't1',
        userId: 'u1',
        role: Role.LEADER,
      });

      const role = await service.getUserTeamRole('u1', 't1');
      expect(role).toBe(Role.LEADER);
    });

    it('should fall back to tenant role when no team membership', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      prisma.team.findUnique.mockResolvedValue({
        id: 't1',
        tenantId: 'ten1',
        deletedAt: null,
      });
      prisma.tenantMember.findUnique.mockResolvedValue({ role: Role.ADMIN });

      const role = await service.getUserTeamRole('u1', 't1');
      expect(role).toBe(Role.ADMIN);
    });
  });

  // ── checkPermission ────────────────────────────────────

  describe('checkPermission', () => {
    beforeEach(() => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.ADMIN, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.teamMember.findMany.mockResolvedValue([]);
    });

    it('should return true when user level >= required level', async () => {
      const result = await service.checkPermission('u1', 'task', 'create');
      // ADMIN(80) >= MEMBER(40) → true
      expect(result).toBe(true);
    });

    it('should return false when user level < required level', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.GUEST, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      const result = await service.checkPermission('u1', 'task', 'create');
      // GUEST(10) < MEMBER(40) → false
      expect(result).toBe(false);
    });

    it('should return false for unknown resource type', async () => {
      const result = await service.checkPermission('u1', 'nonexistent', 'read');
      expect(result).toBe(false);
    });

    it('should return false when user has no role', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([]);

      const result = await service.checkPermission('u1', 'task', 'read');
      expect(result).toBe(false);
    });

    it('should return true via doc share override when user lacks permission', async () => {
      // User is GUEST but there is an active share link
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.GUEST, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.docShare.findFirst.mockResolvedValue({
        id: 'share-1',
        documentId: 'doc-1',
        expiresAt: null,
      });

      const result = await service.checkPermission('u1', 'document', 'read', {
        resourceId: 'doc-1',
      });
      expect(result).toBe(true);
      expect(prisma.docShare.findFirst).toHaveBeenCalledWith({
        where: {
          documentId: 'doc-1',
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: expect.any(Date) } },
          ],
        },
      });
    });

    it('should return false when doc share override fails', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.GUEST, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.docShare.findFirst.mockResolvedValue(null);

      const result = await service.checkPermission('u1', 'document', 'read', {
        resourceId: 'doc-1',
      });
      expect(result).toBe(false);
    });

    it('should not check doc share for non-document resource types', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.GUEST, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      const result = await service.checkPermission('u1', 'task', 'create', {
        resourceId: 'task-1',
      });
      expect(result).toBe(false);
      expect(prisma.docShare.findFirst).not.toHaveBeenCalled();
    });

    it('should not check doc share for non-read operations', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.GUEST, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      const result = await service.checkPermission('u1', 'document', 'update', {
        resourceId: 'doc-1',
      });
      expect(result).toBe(false);
      expect(prisma.docShare.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── hasRole (hierarchy-aware) ──────────────────────────

  describe('hasRole', () => {
    beforeEach(() => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.OWNER, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.teamMember.findMany.mockResolvedValue([]);
    });

    it('should return true when user has a required role (exact match)', async () => {
      const result = await service.hasRole('u1', [Role.OWNER]);
      expect(result).toBe(true);
    });

    it('should return true when user has a higher role than required (hierarchy)', async () => {
      // OWNER (100) >= min(ADMIN(80), MEMBER(40)) = 40 → true
      const result = await service.hasRole('u1', [Role.ADMIN, Role.MEMBER]);
      expect(result).toBe(true);
    });

    it('should return false when user role is below all required roles', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.READER, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      // READER (20) < ADMIN (80) → false
      const result = await service.hasRole('u1', [Role.ADMIN]);
      expect(result).toBe(false);
    });

    it('should return false when user has no role', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([]);

      const result = await service.hasRole('u1', [Role.MEMBER]);
      expect(result).toBe(false);
    });
  });

  // ── requireRole ────────────────────────────────────────

  describe('requireRole', () => {
    beforeEach(() => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.READER, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.teamMember.findMany.mockResolvedValue([]);
    });

    it('should not throw when user has sufficient role', async () => {
      await expect(
        service.requireRole('u1', [Role.READER]),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException when user lacks sufficient role', async () => {
      await expect(
        service.requireRole('u1', [Role.ADMIN]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user has no role', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([]);

      await expect(
        service.requireRole('u1', [Role.MEMBER]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── assignRole ─────────────────────────────────────────

  describe('assignRole', () => {
    it('should upsert tenant membership when no teamId', async () => {
      prisma.tenantMember.upsert.mockResolvedValue({});

      await service.assignRole('u1', Role.ADMIN, 'ten1');

      expect(prisma.tenantMember.upsert).toHaveBeenCalledWith({
        where: { userId_tenantId: { userId: 'u1', tenantId: 'ten1' } },
        update: { role: Role.ADMIN },
        create: { userId: 'u1', tenantId: 'ten1', role: Role.ADMIN },
      });
      expect(prisma.teamMember.upsert).not.toHaveBeenCalled();
    });

    it('should upsert team membership when teamId provided', async () => {
      prisma.teamMember.upsert.mockResolvedValue({});

      await service.assignRole('u1', Role.LEADER, 'ten1', 't1');

      expect(prisma.teamMember.upsert).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 't1', userId: 'u1' } },
        update: { role: Role.LEADER },
        create: { teamId: 't1', userId: 'u1', role: Role.LEADER },
      });
      expect(prisma.tenantMember.upsert).not.toHaveBeenCalled();
    });
  });

  // ── checkApprovalTemplateScope ─────────────────────────

  describe('checkApprovalTemplateScope', () => {
    it('should return true for tenant scope', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'tenant',
        createdBy: 'u-other',
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(true);
    });

    it('should return true when user is in the team scope', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'team:t1',
        createdBy: 'u-other',
      });
      prisma.teamMember.findUnique.mockResolvedValue({
        teamId: 't1',
        userId: 'u1',
        role: Role.MEMBER,
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(true);
    });

    it('should return false when user is not in the team scope', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'team:t1',
        createdBy: 'u-other',
      });
      prisma.teamMember.findUnique.mockResolvedValue(null);

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(false);
    });

    it('should return true when user matches user scope', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'user:u1',
        createdBy: 'u-other',
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(true);
    });

    it('should return true when user is the creator of user-scoped template', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'user:u-other',
        createdBy: 'u1',
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(true);
    });

    it('should return false when user scope does not match and user is not creator', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'user:u-other',
        createdBy: 'u-yet-another',
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(false);
    });

    it('should return false when template not found', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(null);

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(false);
    });

    it('should return false for unknown scope format', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        scope: 'department:sales',
        createdBy: 'u1',
      });

      const result = await service.checkApprovalTemplateScope('u1', 'tpl-1');
      expect(result).toBe(false);
    });
  });

  // ── getUserEffectivePermissions ────────────────────────

  describe('getUserEffectivePermissions', () => {
    it('should return all permissions for a user based on their role level', async () => {
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.OWNER, tenantId: 'ten1', joinedAt: new Date() },
      ]);
      prisma.teamMember.findMany.mockResolvedValue([]);

      const perms = await service.getUserEffectivePermissions('u1');

      // OWNER should have every permission
      expect(perms['task.create']).toBe(true);
      expect(perms['task.read']).toBe(true);
      expect(perms['task.update']).toBe(true);
      expect(perms['task.delete']).toBe(true);
      expect(perms['document.create']).toBe(true);
      expect(perms['tenant.delete']).toBe(true);
      expect(perms['rbac.manage']).toBe(true);
    });

    it('should return partial permissions for a low-role user', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([
        { userId: 'u1', role: Role.READER, tenantId: 'ten1', joinedAt: new Date() },
      ]);

      const perms = await service.getUserEffectivePermissions('u1');

      // READER can read documents and tasks
      expect(perms['document.read']).toBe(true);
      expect(perms['task.read']).toBe(true);
      // READER cannot create
      expect(perms['task.create']).toBe(false);
      expect(perms['document.create']).toBe(false);
    });

    it('should return empty object when user has no role', async () => {
      prisma.tenantMember.findMany.mockReset();
      prisma.tenantMember.findMany.mockResolvedValue([]);

      const perms = await service.getUserEffectivePermissions('u1');
      expect(perms).toEqual({});
    });
  });

  // ── getMinimumRequiredRole ─────────────────────────────

  describe('getMinimumRequiredRole', () => {
    it('should return the min role for a known resource+operation', () => {
      expect(service.getMinimumRequiredRole('task', 'create')).toBe(Role.MEMBER);
      expect(service.getMinimumRequiredRole('tenant', 'delete')).toBe(Role.OWNER);
    });

    it('should return null for unknown resource type', () => {
      expect(service.getMinimumRequiredRole('unknown', 'read')).toBeNull();
    });

    it('should return null for unknown operation', () => {
      expect(service.getMinimumRequiredRole('task', 'unknown_op')).toBeNull();
    });
  });

  // ── getRoleDefinitions ─────────────────────────────────

  describe('getRoleDefinitions', () => {
    it('should return all roles sorted descending by level', () => {
      const defs = service.getRoleDefinitions();
      expect(defs).toHaveLength(6);
      expect(defs[0]).toEqual({ role: Role.OWNER, level: 100 });
      expect(defs[1]).toEqual({ role: Role.ADMIN, level: 80 });
      expect(defs[defs.length - 1]).toEqual({ role: Role.GUEST, level: 10 });
    });
  });

  // ── getRoleFromLevel ───────────────────────────────────

  describe('getRoleFromLevel', () => {
    it('should return correct role for known level', () => {
      expect(service.getRoleFromLevel(100)).toBe(Role.OWNER);
      expect(service.getRoleFromLevel(80)).toBe(Role.ADMIN);
      expect(service.getRoleFromLevel(10)).toBe(Role.GUEST);
    });

    it('should return null for unknown level', () => {
      expect(service.getRoleFromLevel(999)).toBeNull();
    });
  });

  describe('tenant-aware permission evaluation', () => {
    beforeEach(() => {
      prisma.tenantMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.GUEST });
    });

    it('lets tenant admins inherit access to team resources without team membership', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        service.canAccessPermission('task.read', 'user-1', 'tenant-1', {
          teamId: 'team-1',
        }),
      ).resolves.toBe(true);
    });

    it('rejects cross-tenant team scope even for high tenant roles', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-foreign',
        tenantId: 'tenant-2',
        deletedAt: null,
      });

      await expect(
        service.canAccessPermission('task.read', 'user-1', 'tenant-1', {
          teamId: 'team-foreign',
        }),
      ).resolves.toBe(false);
    });

    it('denies guest users from document write operations', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue({ role: Role.GUEST });
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.GUEST });
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        teamId: 'team-1',
        creatorId: 'owner-1',
        deletedAt: null,
        team: {
          tenantId: 'tenant-1',
          deletedAt: null,
        },
      });

      await expect(
        service.canAccessPermission('document.update', 'user-1', 'tenant-1', {
          resourceId: 'doc-1',
        }),
      ).resolves.toBe(false);
    });

    it('allows shared document reads through the unified permission service', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue({ role: Role.GUEST });
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.GUEST });
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        teamId: 'team-1',
        creatorId: 'owner-1',
        deletedAt: null,
        team: {
          tenantId: 'tenant-1',
          deletedAt: null,
        },
      });
      prisma.docShare.findUnique.mockResolvedValue({
        id: 'share-1',
        documentId: 'doc-1',
        permission: 'view',
        accessCode: null,
        expiresAt: null,
      });

      await expect(
        service.canAccessPermission('document.read', 'user-1', 'tenant-1', {
          resourceId: 'doc-1',
          shareToken: 'share-1',
          allowDocumentShare: true,
        }),
      ).resolves.toBe(true);
    });
  });
});
