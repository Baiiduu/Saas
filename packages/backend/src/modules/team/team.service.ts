import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JoinRequestDto } from './dto/join-request.dto';
import { BatchInviteDto } from '../tenant/dto/batch-invite.dto';
import { Role } from '@prisma/client';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';

/** Simple prototype join-request record stored in-memory. */
interface JoinRequestRecord {
  id: string;
  teamId: string;
  userId: string;
  message?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  /**
   * In-memory store for join requests.
   * ⚠ Will be replaced with a DB-backed model in a future iteration.
   */
  private readonly joinRequests = new Map<string, JoinRequestRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Look up the caller's team membership role.
   * Returns null if the caller is not a member or no caller id provided.
   */
  private async getCallerTeamRole(
    teamId: string,
    callerUserId: string | undefined,
    tenantId?: string,
  ): Promise<Role | null> {
    if (!callerUserId) return null;
    if (tenantId) {
      return (await this.rbacService.getEffectiveTeamRole(
        callerUserId,
        tenantId,
        teamId,
      )) as Role | null;
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: callerUserId,
        },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  /**
   * Assert that the caller has at least ADMIN role in the team.
   */
  private async assertLeaderOrAbove(
    teamId: string,
    tenantId: string,
    callerUserId: string | undefined,
  ): Promise<void> {
    if (!callerUserId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.manage', callerUserId, tenantId, {
      teamId,
    });
  }

  /**
   * Fetch the tenantId for a team, throwing if not found or deleted.
   */
  private async findTeamTenantId(
    teamId: string,
  ): Promise<string> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }
    return team.tenantId;
  }

  // ── Team CRUD ───────────────────────────────────────────────

  /**
   * Create a new team within the specified tenant.
   * Any tenant member can create a team.
   */
  async create(userId: string, tenantId: string, dto: CreateTeamDto) {
    await this.rbacService.assertPermission('team.create', userId, tenantId);

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify creator is a tenant member (Finding 2)
    const creatorTenantMember = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: { id: true },
    });
    if (!creatorTenantMember) {
      throw new BadRequestException(
        'Creator is not a member of this tenant',
      );
    }

    // Check team name uniqueness within tenant
    const existingTeam = await this.prisma.team.findUnique({
      where: {
        name_tenantId: {
          name: dto.name,
          tenantId,
        },
      },
    });
    if (existingTeam) {
      throw new ConflictException(
        `A team with the name "${dto.name}" already exists in this tenant`,
      );
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        visibility: dto.visibility ?? 'PRIVATE',
        createdBy: userId,
        tenantId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    // Auto-add creator to the team as ADMIN
    await this.prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: Role.ADMIN,
      },
    });

    this.logger.log(
      `Team "${team.name}" (${team.id}) created in tenant ${tenantId} by user ${userId}`,
    );
    return team;
  }

  /** Find a team by its ID. */
  async findById(userId: string, tenantId: string, id: string) {
    await this.rbacService.assertPermission('team.read', userId, tenantId, {
      resourceId: id,
    });

    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  /** List teams. Optionally filter by tenant. */
  async findAll(userId: string, tenantId: string) {
    await this.rbacService.assertTenantAccess(userId, tenantId);

    const where: any = { deletedAt: null, tenantId };

    return this.prisma.team.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Update a team's properties. */
  async update(id: string, dto: UpdateTeamDto, callerUserId: string | undefined, tenantId: string) {
    if (!callerUserId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('team.update', callerUserId, tenantId, {
      resourceId: id,
    });

    const team = await this.prisma.team.findUnique({
      where: { id },
      select: { id: true, tenantId: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    // Check name uniqueness if name is being changed (Finding 4)
    if (dto.name !== undefined) {
      const existingTeam = await this.prisma.team.findUnique({
        where: {
          name_tenantId: {
            name: dto.name,
            tenantId: team.tenantId,
          },
        },
        select: { id: true },
      });
      if (existingTeam && existingTeam.id !== id) {
        throw new ConflictException(
          `A team with the name "${dto.name}" already exists in this tenant`,
        );
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    const updated = await this.prisma.team.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Team ${id} updated`);
    return updated;
  }

  /** Soft-delete a team. Only ADMIN/OWNER can delete. */
  async delete(id: string, callerUserId: string | undefined, tenantId: string) {
    if (!callerUserId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('team.delete', callerUserId, tenantId, {
      resourceId: id,
    });

    const team = await this.prisma.team.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Team ${id} soft-deleted`);
  }

  // ── Members ─────────────────────────────────────────────────

  /**
   * Add a member to a team.
   * Also ensures the user is a member of the tenant.
   * Only ADMIN/OWNER can add members.
   */
  async addMember(
    teamId: string,
    userId: string,
    dto: AddMemberDto,
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.create', callerUserId, tenantId, {
      teamId,
    });

    const callerRole = await this.getCallerTeamRole(teamId, callerUserId, tenantId);
    if (callerRole === Role.LEADER && (dto.role === Role.ADMIN || dto.role === Role.OWNER)) {
      throw new ForbiddenException('Team leader cannot assign ADMIN or OWNER roles');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for duplicate membership
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    // Ensure user is a tenant member (add if not)
    const tenantMember = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId: team.tenantId,
        },
      },
    });
    if (!tenantMember) {
      await this.prisma.tenantMember.create({
        data: {
          userId,
          tenantId: team.tenantId,
          role: dto.role,
        },
      });
    }

    const member = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    });

    this.logger.log(`User ${userId} added to team ${teamId} as ${dto.role}`);
    return member;
  }

  /** Remove a member from a team. Only ADMIN/OWNER can remove. */
  async removeMember(
    teamId: string,
    userId: string,
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.delete', callerUserId, tenantId, {
      teamId,
    });

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    this.logger.log(`User ${userId} removed from team ${teamId}`);
  }

  /**
   * Update a member's role in a team.
   * ADMIN/OWNER can change roles; OWNER role can only be changed by OWNER.
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    role: Role,
    callerUserId?: string,
    tenantId?: string,
  ) {
    const resolvedTenantId = tenantId ?? await this.findTeamTenantId(teamId);
    if (!callerUserId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.update', callerUserId, resolvedTenantId, {
      teamId,
    });

    const callerRole = await this.getCallerTeamRole(teamId, callerUserId, resolvedTenantId);

    // Find target member
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    // OWNER role can only be changed by OWNER
    if (member.role === Role.OWNER && callerRole !== Role.OWNER) {
      throw new ForbiddenException(
        'Only an OWNER can change another OWNER\'s role',
      );
    }

    if (callerRole === Role.LEADER) {
      if (member.role === Role.ADMIN || role === Role.ADMIN || role === Role.OWNER) {
        throw new ForbiddenException('Team leader cannot manage ADMIN or OWNER roles');
      }
    }

    if (callerRole === Role.ADMIN && role === Role.OWNER) {
      throw new ForbiddenException('Only an OWNER can assign the OWNER role');
    }

    const updated = await this.prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`User ${userId} role in team ${teamId} changed to ${role}`);

    await this.auditService.append({
      userId: callerUserId,
      action: 'member.role.update',
      resourceType: 'team',
      resourceId: teamId,
      tenantId: resolvedTenantId,
      detail: {
        targetUserId: userId,
        previousRole: member.role,
        nextRole: role,
      },
    });

    return updated;
  }

  /** Get a specific member of a team. */
  async getMember(teamId: string, userId: string, callerUserId: string, tenantId: string) {
    await this.rbacService.assertPermission('member.read', callerUserId, tenantId, {
      teamId,
    });

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    return member;
  }

  /** List all members of a team. */
  async getMembers(teamId: string, callerUserId: string, tenantId: string) {
    await this.rbacService.assertPermission('member.read', callerUserId, tenantId, {
      teamId,
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async resolveMembers(
    teamId: string,
    callerUserId: string,
    tenantId: string,
    query: string,
    limit = 5,
  ) {
    await this.rbacService.assertPermission('member.read', callerUserId, tenantId, {
      teamId,
    });

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 10);

    return this.prisma.teamMember.findMany({
      where: {
        teamId,
        user: {
          deletedAt: null,
          OR: [
            { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
            { email: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
      take: safeLimit,
    });
  }

  // ── Archive / Unarchive ────────────────────────────────────

  /**
   * Archive or unarchive a team.
   * Only ADMIN/OWNER can archive/unarchive a team.
   */
  async archive(teamId: string, isArchived: boolean, callerUserId: string | undefined, tenantId: string) {
    if (!callerUserId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('team.update', callerUserId, tenantId, {
      resourceId: teamId,
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { isArchived },
    });

    this.logger.log(`Team ${teamId} ${isArchived ? 'archived' : 'unarchived'} by user ${callerUserId}`);
    return updated;
  }

  // ── Visibility toggle ──────────────────────────────────────

  /**
   * Toggle team visibility between PUBLIC and PRIVATE.
   * Only ADMIN/OWNER can change visibility.
   */
  async setVisibility(
    teamId: string,
    visibility: 'PUBLIC' | 'PRIVATE',
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('team.update', callerUserId, tenantId, {
      resourceId: teamId,
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { visibility },
    });

    this.logger.log(`Team ${teamId} visibility set to ${visibility} by user ${callerUserId}`);
    return updated;
  }

  // ── Join Requests ───────────────────────────────────────────

  /**
   * Create a join request for a team.
   * Any authenticated user can request to join a team.
   */
  async createJoinRequest(teamId: string, userId: string, dto: JoinRequestDto, tenantId: string) {
    await this.rbacService.assertTenantAccess(userId, tenantId);

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true, deletedAt: true, visibility: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    if (team.tenantId !== tenantId) {
      throw new ForbiddenException('Cross-tenant team access is not allowed');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException('You are already a member of this team');
    }

    // Check for existing pending request
    for (const record of this.joinRequests.values()) {
      if (record.teamId === teamId && record.userId === userId && record.status === 'PENDING') {
        throw new ConflictException('You already have a pending join request for this team');
      }
    }

    const id = this.generateRequestId();
    const joinRequest: JoinRequestRecord = {
      id,
      teamId,
      userId,
      message: dto.message,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.joinRequests.set(id, joinRequest);
    this.logger.log(`Join request ${id} created for team ${teamId} by user ${userId}`);

    return {
      id,
      teamId,
      status: joinRequest.status,
      message: dto.message,
      createdAt: joinRequest.createdAt,
    };
  }

  /**
   * Approve or reject a join request.
   * Only ADMIN/OWNER of the team can process join requests.
   */
  async processJoinRequest(
    teamId: string,
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.assertLeaderOrAbove(teamId, tenantId, callerUserId);

    const request = this.joinRequests.get(requestId);
    if (!request) {
      throw new NotFoundException('Join request not found');
    }
    if (request.teamId !== teamId) {
      throw new BadRequestException('Join request does not belong to this team');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Join request has already been ${request.status.toLowerCase()}`);
    }

    if (action === 'APPROVED') {
      // Verify user is still a valid user
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { id: true },
      });
      if (!user) {
        this.joinRequests.delete(requestId);
        throw new BadRequestException('User no longer exists');
      }

      // Ensure user is a tenant member
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { tenantId: true },
      });
      if (!team) {
        throw new NotFoundException('Team not found');
      }

      const tenantMember = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: request.userId,
            tenantId: team.tenantId,
          },
        },
      });
      if (!tenantMember) {
        await this.prisma.tenantMember.create({
          data: {
            userId: request.userId,
            tenantId: team.tenantId,
            role: Role.MEMBER,
          },
        });
      }

      // Add user to team as MEMBER
      await this.prisma.teamMember.create({
        data: {
          teamId,
          userId: request.userId,
          role: Role.MEMBER,
        },
      });

      this.logger.log(`Join request ${requestId} approved: user ${request.userId} added to team ${teamId}`);
    } else {
      this.logger.log(`Join request ${requestId} rejected by user ${callerUserId}`);
    }

    request.status = action;
    this.joinRequests.set(requestId, request);

    return {
      id: requestId,
      teamId,
      userId: request.userId,
      status: action,
    };
  }

  /** List pending join requests for a team. */
  async getJoinRequests(teamId: string, callerUserId: string | undefined, tenantId: string) {
    await this.assertLeaderOrAbove(teamId, tenantId, callerUserId);

    const requests: any[] = [];
    for (const record of this.joinRequests.values()) {
      if (record.teamId === teamId) {
        requests.push(record);
      }
    }
    return requests;
  }

  // ── Batch Invite ────────────────────────────────────────────

  /**
   * Send batch invitations to a team.
   * Only ADMIN/OWNER can invite members.
   * For prototype, this returns the list of successfully created invitations.
   */
  async batchInvite(
    teamId: string,
    dto: BatchInviteDto,
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.create', callerUserId, tenantId, {
      teamId,
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }

    const results: Array<{ email: string; status: string; message?: string }> = [];

    for (const email of dto.emails) {
      try {
        // Find user by email
        const user = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (!user) {
          results.push({
            email,
            status: 'skipped',
            message: 'User not found. Invitation will be sent when user registers.',
          });
          continue;
        }

        // Check for duplicate membership
        const existingMember = await this.prisma.teamMember.findUnique({
          where: {
            teamId_userId: { teamId, userId: user.id },
          },
          select: { id: true },
        });
        if (existingMember) {
          results.push({ email, status: 'skipped', message: 'Already a member' });
          continue;
        }

        // Ensure user is a tenant member
        const tenantMember = await this.prisma.tenantMember.findUnique({
          where: {
            userId_tenantId: { userId: user.id, tenantId: team.tenantId },
          },
        });
        if (!tenantMember) {
          await this.prisma.tenantMember.create({
            data: {
              userId: user.id,
              tenantId: team.tenantId,
              role: Role.MEMBER,
            },
          });
        }

        // Add to team
        await this.prisma.teamMember.create({
          data: {
            teamId,
            userId: user.id,
            role: Role.MEMBER,
          },
        });

        results.push({ email, status: 'success' });
        this.logger.log(`Batch invite: ${email} added to team ${teamId}`);
      } catch (error: any) {
        results.push({ email, status: 'error', message: error.message });
      }
    }

    return { results };
  }

  // ── Member leave (self) ─────────────────────────────────────

  /**
   * Leave a team (remove self from team).
   * Any member can leave a team. The OWNER cannot leave; they must transfer ownership first.
   */
  async leaveTeam(teamId: string, userId: string, tenantId: string) {
    await this.rbacService.assertTenantAccess(userId, tenantId);

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      select: { role: true },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this team');
    }

    if (member.role === Role.OWNER) {
      throw new BadRequestException(
        'Team owner cannot leave the team. Transfer ownership first or delete the team.',
      );
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    this.logger.log(`User ${userId} left team ${teamId}`);
  }

  // ── Member remove (admin/owner only) ────────────────────────

  /**
   * Remove a member from a team.
   * Overrides the existing removeMember to add permission checks:
   * - ADMIN can remove MEMBER, LEADER, READER, GUEST
   * - OWNER can remove any role except themselves
   */
  async removeMemberWithCheck(
    teamId: string,
    targetUserId: string,
    callerUserId?: string,
    tenantId?: string,
  ) {
    if (!callerUserId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    await this.rbacService.assertPermission('member.delete', callerUserId, tenantId, {
      teamId,
    });

    const callerRole = await this.getCallerTeamRole(teamId, callerUserId, tenantId);

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: targetUserId },
      },
      select: { role: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    if (targetUserId === callerUserId) {
      throw new BadRequestException('Use the leave endpoint to remove yourself');
    }

    // ADMIN cannot remove OWNER or ADMIN
    if (callerRole === Role.LEADER && (member.role === Role.ADMIN || member.role === Role.OWNER)) {
      throw new ForbiddenException('Team leader cannot remove ADMINs or the OWNER');
    }

    if (callerRole === Role.ADMIN && (member.role === Role.OWNER || member.role === Role.ADMIN)) {
      throw new ForbiddenException('ADMIN cannot remove other ADMINs or the OWNER');
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId: targetUserId },
      },
    });

    this.logger.log(`User ${targetUserId} removed from team ${teamId} by user ${callerUserId}`);
  }

  // ── Helpers ─────────────────────────────────────────────────

  private generateRequestId(): string {
    return (
      'jr_' +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10)
    );
  }
}
