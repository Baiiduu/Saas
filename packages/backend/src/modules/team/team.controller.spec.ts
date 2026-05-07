import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Role, TeamVisibility } from '@prisma/client';

describe('TeamController', () => {
  let controller: TeamController;
  let teamService: any;

  const mockCurrentUser = {
    sub: 'user-1',
    email: 'user@example.com',
    type: 'access' as const,
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Engineering',
    description: 'Software engineering team',
    visibility: TeamVisibility.PRIVATE,
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockTeamMember = {
    id: 'tm-1',
    teamId: 'team-1',
    userId: 'user-1',
    role: Role.ADMIN,
    joinedAt: new Date(),
  };

  beforeEach(async () => {
    teamService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addMember: jest.fn(),
      removeMemberWithCheck: jest.fn(),
      updateMemberRole: jest.fn(),
      getMember: jest.fn(),
      getMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        { provide: TeamService, useValue: teamService },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/teams', () => {
    it('should call service.create with user, tenantId and DTO', async () => {
      const dto: CreateTeamDto = { name: 'Engineering', visibility: TeamVisibility.PRIVATE };
      teamService.create.mockResolvedValue(mockTeam);

      const result = await controller.create(mockCurrentUser, 'tenant-1', dto);

      expect(teamService.create).toHaveBeenCalledWith('user-1', 'tenant-1', dto);
      expect(result).toEqual(mockTeam);
    });
  });

  describe('GET /api/v1/teams', () => {
    it('should call service.findAll without filter', async () => {
      teamService.findAll.mockResolvedValue([mockTeam]);

      const result = await controller.findAll(undefined);

      expect(teamService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([mockTeam]);
    });

    it('should call service.findAll with tenantId filter', async () => {
      teamService.findAll.mockResolvedValue([mockTeam]);

      const result = await controller.findAll('tenant-1');

      expect(teamService.findAll).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual([mockTeam]);
    });
  });

  describe('GET /api/v1/teams/:id', () => {
    it('should call service.findById with id', async () => {
      teamService.findById.mockResolvedValue(mockTeam);

      const result = await controller.findById('team-1');

      expect(teamService.findById).toHaveBeenCalledWith('team-1');
      expect(result).toEqual(mockTeam);
    });
  });

  describe('PATCH /api/v1/teams/:id', () => {
    it('should call service.update with id, DTO and caller user id', async () => {
      const dto: UpdateTeamDto = { name: 'Engineering Team' };
      teamService.update.mockResolvedValue({ ...mockTeam, name: 'Engineering Team' });

      const result = await controller.update(mockCurrentUser, 'team-1', dto);

      expect(teamService.update).toHaveBeenCalledWith('team-1', dto, 'user-1');
      expect(result.name).toBe('Engineering Team');
    });
  });

  describe('DELETE /api/v1/teams/:id', () => {
    it('should call service.delete with id and caller user id', async () => {
      teamService.delete.mockResolvedValue(undefined);

      await controller.delete(mockCurrentUser, 'team-1');

      expect(teamService.delete).toHaveBeenCalledWith('team-1', 'user-1');
    });
  });

  describe('GET /api/v1/teams/:id/members/:userId', () => {
    it('should call service.getMember with team and user ids', async () => {
      teamService.getMember.mockResolvedValue(mockTeamMember);

      const result = await controller.getMember('team-1', 'user-1');

      expect(teamService.getMember).toHaveBeenCalledWith('team-1', 'user-1');
      expect(result).toEqual(mockTeamMember);
    });
  });

  describe('POST /api/v1/teams/:id/members/:userId', () => {
    it('should call service.addMember with team id, user id, DTO and caller user id', async () => {
      const dto: AddMemberDto = { role: Role.MEMBER };
      teamService.addMember.mockResolvedValue(mockTeamMember);

      const result = await controller.addMember(mockCurrentUser, 'team-1', 'user-2', dto);

      expect(teamService.addMember).toHaveBeenCalledWith('team-1', 'user-2', dto, 'user-1');
      expect(result).toEqual(mockTeamMember);
    });
  });

  describe('DELETE /api/v1/teams/:id/members/:userId', () => {
    it('should call service.removeMemberWithCheck with team id, user id and caller user id', async () => {
      teamService.removeMemberWithCheck.mockResolvedValue(undefined);

      await controller.removeMemberWithCheck(mockCurrentUser, 'team-1', 'user-1');

      expect(teamService.removeMemberWithCheck).toHaveBeenCalledWith('team-1', 'user-1', 'user-1');
    });
  });

  describe('PATCH /api/v1/teams/:id/members/:userId/role', () => {
    it('should call service.updateMemberRole with team id, user id, role and caller user id', async () => {
      const dto: UpdateMemberRoleDto = { role: Role.LEADER };
      teamService.updateMemberRole.mockResolvedValue({
        ...mockTeamMember,
        role: Role.LEADER,
      });

      const result = await controller.updateMemberRole(mockCurrentUser, 'team-1', 'user-1', dto);

      expect(teamService.updateMemberRole).toHaveBeenCalledWith('team-1', 'user-1', Role.LEADER, 'user-1');
      expect(result.role).toBe(Role.LEADER);
    });
  });
});
