import { Test, TestingModule } from '@nestjs/testing';
import { TenantController, InvitationController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Role } from '@prisma/client';

describe('TenantController', () => {
  let controller: TenantController;
  let tenantService: any;

  const mockCurrentUser = {
    sub: 'user-1',
    email: 'user@example.com',
    type: 'access' as const,
  };

  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    schemaName: 't_abc123',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    tenantService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      getMembers: jest.fn(),
      createInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: TenantService, useValue: tenantService },
      ],
    }).compile();

    controller = module.get<TenantController>(TenantController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/tenants', () => {
    it('should call service.create with current user and DTO', async () => {
      const dto: CreateTenantDto = { name: 'Acme Corp', industry: 'Technology' };
      tenantService.create.mockResolvedValue(mockTenant);

      const result = await controller.create(mockCurrentUser, dto);

      expect(tenantService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('GET /api/v1/tenants', () => {
    it('should call service.findAll', async () => {
      tenantService.findAll.mockResolvedValue([mockTenant]);

      const result = await controller.findAll();

      expect(tenantService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockTenant]);
    });
  });

  describe('GET /api/v1/tenants/:id', () => {
    it('should call service.findById with id', async () => {
      tenantService.findById.mockResolvedValue(mockTenant);

      const result = await controller.findById('tenant-1');

      expect(tenantService.findById).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(mockTenant);
    });
  });

  describe('GET /api/v1/tenants/:id/members', () => {
    it('should call service.getMembers with tenant id', async () => {
      const mockMembers = [{ userId: 'user-1', role: Role.OWNER }];
      tenantService.getMembers.mockResolvedValue(mockMembers);

      const result = await controller.getMembers('tenant-1');

      expect(tenantService.getMembers).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(mockMembers);
    });
  });

  describe('POST /api/v1/tenants/:id/invitations', () => {
    it('should call service.createInvitation with params', async () => {
      const dto: CreateInvitationDto = {
        teamId: 'team-1',
        email: 'invited@example.com',
        role: Role.MEMBER,
      };
      const mockInvitation = { token: 'abc123', inviteLink: '/api/v1/invitations/abc123/accept' };
      tenantService.createInvitation.mockResolvedValue(mockInvitation);

      const result = await controller.createInvitation('tenant-1', mockCurrentUser, dto);

      expect(tenantService.createInvitation).toHaveBeenCalledWith('tenant-1', 'user-1', dto);
      expect(result).toEqual(mockInvitation);
    });
  });
});

describe('InvitationController', () => {
  let controller: InvitationController;
  let tenantService: any;

  const mockCurrentUser = {
    sub: 'user-2',
    email: 'user2@example.com',
    type: 'access' as const,
  };

  beforeEach(async () => {
    tenantService = {
      acceptInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        { provide: TenantService, useValue: tenantService },
      ],
    }).compile();

    controller = module.get<InvitationController>(InvitationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/invitations/:token/accept', () => {
    it('should call service.acceptInvitation with token and user', async () => {
      const mockResult = { teamId: 'team-1', userId: 'user-2', role: Role.MEMBER };
      tenantService.acceptInvitation.mockResolvedValue(mockResult);

      const result = await controller.accept('invitation-token', mockCurrentUser);

      expect(tenantService.acceptInvitation).toHaveBeenCalledWith('invitation-token', 'user-2');
      expect(result).toEqual(mockResult);
    });
  });
});
