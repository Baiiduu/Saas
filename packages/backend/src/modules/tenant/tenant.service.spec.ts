import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantProvisionService } from './tenant.provision.service';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Role } from '@prisma/client';

describe('TenantService', () => {
  let service: TenantService;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    avatar: null,
  };

  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    schemaName: 't_abc123',
    industry: 'Technology',
    scale: '50-200',
    logo: null,
    status: 'active',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockTenantMember = {
    id: 'tm-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: Role.OWNER,
    joinedAt: new Date(),
    user: { ...mockUser },
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Engineering',
    tenantId: 'tenant-1',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
      },
      teamMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const mockProvisionService = {
      provisionSchema: jest.fn().mockResolvedValue(undefined),
      deprovisionSchema: jest.fn().mockResolvedValue(undefined),
      schemaExists: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantProvisionService, useValue: mockProvisionService },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateTenantDto = {
      name: 'Acme Corp',
      industry: 'Technology',
      scale: '50-200',
    };

    it('should create a tenant and auto-appoint creator as OWNER', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null); // slug is unique
      prisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        members: [mockTenantMember],
      });

      const result = await service.create('user-1', dto);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'acme-corp' },
        select: { id: true },
      });
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: dto.name,
            slug: 'acme-corp',
            schemaName: expect.any(String),
            industry: dto.industry,
            scale: dto.scale,
            ownerId: 'user-1',
            members: {
              create: { userId: 'user-1', role: Role.OWNER },
            },
          }),
        }),
      );
      expect(result.name).toBe(mockTenant.name);
      expect(result.members).toHaveLength(1);
    });

    it('should throw ConflictException when a tenant with that name already exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  // ── findById ───────────────────────────────────────────────

  describe('findById', () => {
    it('should return a tenant when found and not deleted', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        members: [mockTenantMember],
      });

      const result = await service.findById('tenant-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        include: expect.any(Object),
      });
      expect(result.id).toBe('tenant-1');
    });

    it('should throw NotFoundException when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when tenant is soft-deleted', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        deletedAt: new Date(),
        members: [],
      });

      await expect(service.findById('tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all active tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([mockTenant]);

      const result = await service.findAll();

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no tenants exist', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── getMembers ─────────────────────────────────────────────

  describe('getMembers', () => {
    it('should return members for an active tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', deletedAt: null });
      prisma.tenantMember.findMany.mockResolvedValue([mockTenantMember]);

      const result = await service.getMembers('tenant-1');

      expect(prisma.tenantMember.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: expect.any(Object),
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getMembers('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── createInvitation ───────────────────────────────────────

  describe('createInvitation', () => {
    const dto: CreateInvitationDto = {
      teamId: 'team-1',
      email: 'invited@example.com',
      role: Role.MEMBER,
    };

    it('should create an invitation and return a token', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
      });

      const result = await service.createInvitation('tenant-1', 'user-1', dto);

      expect(result.token).toBeDefined();
      expect(result.inviteLink).toContain(result.token);
      expect(result.teamId).toBe('team-1');
      expect(result.role).toBe(Role.MEMBER);
      expect(result.email).toBe('invited@example.com');
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvitation('nonexistent', 'user-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when team does not belong to tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'other-tenant',
      });

      await expect(
        service.createInvitation('tenant-1', 'user-1', dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── acceptInvitation ───────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should accept a valid invitation and add user to team and tenant', async () => {
      // Create an invitation first
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
      });

      const invitation = await service.createInvitation(
        'tenant-1',
        'user-1',
        { teamId: 'team-1', role: Role.MEMBER },
      );

      // Mock accept flow
      prisma.user.findUnique.mockResolvedValue({ email: undefined }); // no email restriction
      prisma.tenantMember.findUnique.mockResolvedValue(null); // not yet member
      prisma.tenantMember.create.mockResolvedValue({
        id: 'tm-2',
        userId: 'user-2',
        tenantId: 'tenant-1',
        role: Role.MEMBER,
        joinedAt: new Date(),
      });
      prisma.teamMember.findUnique.mockResolvedValue(null); // not yet team member
      prisma.teamMember.create.mockResolvedValue({
        id: 'team-member-1',
        teamId: 'team-1',
        userId: 'user-2',
        role: Role.MEMBER,
        joinedAt: new Date(),
        team: { id: 'team-1', name: 'Engineering' },
        user: { id: 'user-2', email: 'user2@example.com', displayName: 'User 2', avatar: null },
      });

      const result = await service.acceptInvitation(invitation.token, 'user-2');

      expect(prisma.tenantMember.create).toHaveBeenCalled();
      expect(prisma.teamMember.create).toHaveBeenCalled();
      expect(result.teamId).toBe('team-1');
    });

    it('should throw BadRequestException for invalid token', async () => {
      await expect(
        service.acceptInvitation('invalid-token', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when email does not match', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
      });

      const invitation = await service.createInvitation(
        'tenant-1',
        'user-1',
        { teamId: 'team-1', email: 'specific@example.com', role: Role.MEMBER },
      );

      prisma.user.findUnique.mockResolvedValue({ email: 'wrong@example.com' });

      await expect(
        service.acceptInvitation(invitation.token, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired invitation', async () => {
      // Create an invitation with a manually expired token
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        tenantId: 'tenant-1',
      });

      // Override the expiresAt by accessing the private invitations map
      const invitation = await service.createInvitation(
        'tenant-1',
        'user-1',
        { teamId: 'team-1', role: Role.MEMBER },
      );

      // Manually set the invitation to be expired
      const invitationRecord = (service as any).invitations.get(invitation.token);
      invitationRecord.expiresAt = new Date(Date.now() - 1000); // already expired

      await expect(
        service.acceptInvitation(invitation.token, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
