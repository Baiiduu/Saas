import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { Role, TeamVisibility } from '@prisma/client';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: any;

  const mockTenant = {
    id: 'tenant-1',
  };

  const mockTenantMember = {
    id: 'tm-tenant',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: Role.ADMIN,
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Engineering',
    description: 'Software engineering team',
    visibility: TeamVisibility.PRIVATE,
    isArchived: false,
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creator: {
      id: 'user-1',
      email: 'creator@example.com',
      displayName: 'Creator',
      avatar: null,
    },
  };

  const mockTeamMember = {
    id: 'tm-1',
    teamId: 'team-1',
    userId: 'user-1',
    role: Role.ADMIN,
    joinedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'creator@example.com',
      displayName: 'Creator',
      avatar: null,
    },
    team: {
      id: 'team-1',
      name: 'Engineering',
    },
  };

  const mockCallerAdmin = 'user-admin';
  const mockCallerOwner = 'user-owner';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      tenant: {
        findUnique: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      teamMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateTeamDto = {
      name: 'Engineering',
      description: 'Software engineering team',
      visibility: TeamVisibility.PRIVATE,
    };

    it('should create a team and auto-add creator as ADMIN', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenantMember.findUnique.mockResolvedValue(mockTenantMember); // creator is tenant member
      prisma.team.findUnique.mockResolvedValue(null); // no duplicate name
      prisma.team.create.mockResolvedValue(mockTeam);
      prisma.teamMember.create.mockResolvedValue(mockTeamMember);

      const result = await service.create('user-1', 'tenant-1', dto);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        select: { id: true },
      });
      expect(prisma.tenantMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_tenantId: { userId: 'user-1', tenantId: 'tenant-1' },
        },
        select: { id: true },
      });
      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: dto.name,
            description: dto.description,
            visibility: TeamVisibility.PRIVATE,
            createdBy: 'user-1',
            tenantId: 'tenant-1',
          }),
        }),
      );
      expect(prisma.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: mockTeam.id,
            userId: 'user-1',
            role: Role.ADMIN,
          }),
        }),
      );
      expect(result.name).toBe(mockTeam.name);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'nonexistent', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when creator is not a tenant member', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenantMember.findUnique.mockResolvedValue(null); // not a tenant member

      await expect(
        service.create('non-member', 'tenant-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when team name already exists in tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenantMember.findUnique.mockResolvedValue(mockTenantMember);
      prisma.team.findUnique.mockResolvedValue(mockTeam); // duplicate

      await expect(service.create('user-1', 'tenant-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.team.create).not.toHaveBeenCalled();
    });
  });

  // ── findById ───────────────────────────────────────────────

  describe('findById', () => {
    it('should return a team when found and not deleted', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [mockTeamMember],
      });

      const result = await service.findById('team-1');

      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        include: expect.any(Object),
      });
      expect(result.id).toBe('team-1');
    });

    it('should throw NotFoundException when team is not found', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when team is soft-deleted', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        deletedAt: new Date(),
        members: [],
      });

      await expect(service.findById('team-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all active teams', async () => {
      prisma.team.findMany.mockResolvedValue([mockTeam]);

      const result = await service.findAll();

      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter teams by tenantId when provided', async () => {
      prisma.team.findMany.mockResolvedValue([mockTeam]);

      const result = await service.findAll('tenant-1');

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, tenantId: 'tenant-1' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ── update ─────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateTeamDto = {
      name: 'Engineering Team',
      description: 'Updated description',
    };

    it('should update team properties', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', tenantId: 'tenant-1', deletedAt: null });
      prisma.team.findUnique
        .mockResolvedValueOnce({ id: 'team-1', tenantId: 'tenant-1', deletedAt: null }) // existence check
        .mockResolvedValueOnce(null); // no name collision
      prisma.team.update.mockResolvedValue({ ...mockTeam, name: 'Engineering Team' });

      const result = await service.update('team-1', dto, 'user-1');

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { name: 'Engineering Team', description: 'Updated description' },
        include: expect.any(Object),
      });
      expect(result.name).toBe('Engineering Team');
    });

    it('should throw ConflictException when new name collides with another team', async () => {
      prisma.team.findUnique
        .mockResolvedValueOnce({ id: 'team-1', tenantId: 'tenant-1', deletedAt: null }) // existence
        .mockResolvedValueOnce({ id: 'team-2' }); // collision

      await expect(
        service.update('team-1', dto, 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  // ── delete ─────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft-delete a team when caller is ADMIN', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.ADMIN }); // caller role
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', deletedAt: null });
      prisma.team.update.mockResolvedValue({ ...mockTeam, deletedAt: new Date() });

      await service.delete('team-1', 'user-admin');

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException when caller is not ADMIN/OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.MEMBER });

      await expect(
        service.delete('team-1', 'user-member'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── addMember ──────────────────────────────────────────────

  describe('addMember', () => {
    const dto: AddMemberDto = { role: Role.MEMBER };

    it('should add a member and sync tenant membership', async () => {
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }); // caller role (auth check)
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.teamMember.findUnique.mockResolvedValue(null); // not yet member (dup check)
      prisma.tenantMember.findUnique.mockResolvedValue(null); // not yet tenant member
      prisma.tenantMember.create.mockResolvedValue({
        id: 'ntm-1',
        userId: 'user-2',
        tenantId: 'tenant-1',
        role: Role.MEMBER,
        joinedAt: new Date(),
      });
      prisma.teamMember.create.mockResolvedValue({
        ...mockTeamMember,
        userId: 'user-2',
        role: Role.MEMBER,
      });

      const result = await service.addMember('team-1', 'user-2', dto, 'user-admin');

      expect(prisma.tenantMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            tenantId: 'tenant-1',
          }),
        }),
      );
      expect(prisma.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: 'team-1',
            userId: 'user-2',
            role: Role.MEMBER,
          }),
        }),
      );
      expect(result.role).toBe(Role.MEMBER);
    });

    it('should skip tenant member creation when user already a tenant member', async () => {
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }); // caller role
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.teamMember.findUnique
        .mockResolvedValueOnce(null) // not yet team member
        .mockResolvedValueOnce(null); // not yet team member (dup)
      prisma.tenantMember.findUnique.mockResolvedValue(mockTenantMember); // ALREADY tenant member
      prisma.teamMember.create.mockResolvedValue({
        ...mockTeamMember,
        userId: 'user-2',
        role: Role.MEMBER,
      });

      const result = await service.addMember('team-1', 'user-2', dto, 'user-admin');

      // tenantMember.create should NOT have been called
      expect(prisma.tenantMember.create).not.toHaveBeenCalled();
      expect(result.role).toBe(Role.MEMBER);
    });

    it('should throw ForbiddenException when caller is not ADMIN/OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.MEMBER });

      await expect(
        service.addMember('team-1', 'user-2', dto, 'user-member'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.teamMember.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('nonexistent', 'user-2', dto, 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('team-1', 'nonexistent', dto, 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already a member', async () => {
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller role
        .mockResolvedValueOnce(mockTeamMember); // already a member
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });

      await expect(
        service.addMember('team-1', 'user-2', dto, 'user-admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── removeMember ───────────────────────────────────────────

  describe('removeMember', () => {
    it('should remove a member from the team when caller is ADMIN', async () => {
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller role
        .mockResolvedValueOnce(mockTeamMember); // target member exists
      prisma.teamMember.delete.mockResolvedValue(mockTeamMember);

      await service.removeMember('team-1', 'user-1', 'user-admin');

      expect(prisma.teamMember.delete).toHaveBeenCalledWith({
        where: {
          teamId_userId: { teamId: 'team-1', userId: 'user-1' },
        },
      });
    });

    it('should throw ForbiddenException when caller is not ADMIN/OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: Role.MEMBER });

      await expect(
        service.removeMember('team-1', 'user-1', 'user-member'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller role
        .mockResolvedValueOnce(null); // target not found

      await expect(
        service.removeMember('team-1', 'nonexistent', 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateMemberRole ───────────────────────────────────────

  describe('updateMemberRole', () => {
    it('should update the role of a team member when caller is ADMIN', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller role
        .mockResolvedValueOnce(mockTeamMember); // target member
      prisma.teamMember.update.mockResolvedValue({
        ...mockTeamMember,
        role: Role.LEADER,
      });

      const result = await service.updateMemberRole('team-1', 'user-1', Role.LEADER, 'user-admin');

      expect(prisma.teamMember.update).toHaveBeenCalledWith({
        where: {
          teamId_userId: { teamId: 'team-1', userId: 'user-1' },
        },
        data: { role: Role.LEADER },
        include: expect.any(Object),
      });
      expect(result.role).toBe(Role.LEADER);
    });

    it('should throw ForbiddenException when caller is not ADMIN/OWNER', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.MEMBER }); // caller is MEMBER

      await expect(
        service.updateMemberRole('team-1', 'user-1', Role.LEADER, 'user-member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when caller is ADMIN trying to change OWNER role', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller is ADMIN
        .mockResolvedValueOnce({ ...mockTeamMember, role: Role.OWNER }); // target is OWNER

      await expect(
        service.updateMemberRole('team-1', 'user-owner', Role.MEMBER, 'user-admin'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('nonexistent', 'user-1', Role.LEADER, 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      prisma.teamMember.findUnique
        .mockResolvedValueOnce({ role: Role.ADMIN }) // caller
        .mockResolvedValueOnce(null); // target not found

      await expect(
        service.updateMemberRole('team-1', 'nonexistent', Role.LEADER, 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMember ──────────────────────────────────────────────

  describe('getMember', () => {
    it('should return a specific team member', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(mockTeamMember);

      const result = await service.getMember('team-1', 'user-1');

      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: {
          teamId_userId: { teamId: 'team-1', userId: 'user-1' },
        },
        include: expect.any(Object),
      });
      expect(result.userId).toBe('user-1');
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getMember('team-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMembers (list) ──────────────────────────────────────

  describe('getMembers (list)', () => {
    it('should return all members of a team', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', deletedAt: null });
      prisma.teamMember.findMany.mockResolvedValue([mockTeamMember]);

      const result = await service.getMembers('team-1');

      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        include: expect.any(Object),
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getMembers('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when team is soft-deleted', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        deletedAt: new Date(),
      });

      await expect(service.getMembers('team-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
