import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantProvisionService } from './tenant.provision.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateQuotaDto, TenantQuota } from './dto/quota.dto';
import { Role } from '@prisma/client';

/** Simple prototype invitation record stored in-memory. */
interface InvitationRecord {
  token: string;
  tenantId: string;
  teamId: string;
  email?: string;
  role: Role;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  /**
   * In-memory invitation store for the prototype.
   * ⚠ Will be replaced with a DB-backed model in a future iteration.
   */
  private readonly invitations = new Map<string, InvitationRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisionService: TenantProvisionService,
  ) {}

  // ── Tenant CRUD ─────────────────────────────────────────────

  /**
   * Create a new tenant and automatically appoint the creator as Owner.
   *
   * - slug: auto-generated from the name (lowercased, spaces → hyphens)
   * - schemaName: auto-generated as `t_<random_id>`
   * - schema: auto-created via raw SQL for multi-tenant isolation
   */
  async create(userId: string, dto: CreateTenantDto) {
    const slug = this.generateSlug(dto.name);
    const schemaName = `t_${this.randomId()}`;

    // Ensure slug is unique
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existingSlug) {
      throw new ConflictException('A tenant with this name already exists');
    }

    // Auto-create the tenant schema via dedicated provision service
    await this.provisionService.provisionSchema(schemaName);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        schemaName,
        industry: dto.industry,
        scale: dto.scale,
        logo: dto.logo,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: {
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

    this.logger.log(`Tenant "${tenant.name}" (${tenant.id}) created by user ${userId}`);
    return tenant;
  }

  /**
   * Update enterprise info.
   * Only the tenant owner can update the tenant details.
   */
  async update(id: string, userId: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    // Only the owner can update tenant info
    if (tenant.ownerId !== userId) {
      throw new BadRequestException('Only the tenant owner can update enterprise information');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.industry !== undefined) data.industry = dto.industry;
    if (dto.scale !== undefined) data.scale = dto.scale;
    if (dto.logo !== undefined) data.logo = dto.logo;

    // If name is being changed, regenerate the slug
    if (dto.name !== undefined) {
      const newSlug = this.generateSlug(dto.name);
      const existingSlug = await this.prisma.tenant.findUnique({
        where: { slug: newSlug },
        select: { id: true },
      });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException('A tenant with this name already exists');
      }
      data.slug = newSlug;
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data,
      include: {
        owner: {
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

    this.logger.log(`Tenant ${id} updated by user ${userId}`);
    return updated;
  }

  /** Find a tenant by its ID. */
  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
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

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /** List all active tenants. */
  async findAll() {
    return this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Members ─────────────────────────────────────────────────

  /** Get all members of a tenant. */
  async getMembers(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, deletedAt: true },
    });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenantMember.findMany({
      where: { tenantId },
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

  // ── Invitations ─────────────────────────────────────────────

  /**
   * Create an invitation to join a team within the tenant.
   * Returns a shareable token that can be used to accept the invitation.
   */
  async createInvitation(
    tenantId: string,
    createdBy: string,
    dto: CreateInvitationDto,
  ) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify team exists and belongs to this tenant
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
      select: { id: true, tenantId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.tenantId !== tenantId) {
      throw new BadRequestException('Team does not belong to this tenant');
    }

    const token = this.generateToken();
    const role = dto.role ?? Role.MEMBER;
    const invitation: InvitationRecord = {
      token,
      tenantId,
      teamId: dto.teamId,
      email: dto.email,
      role,
      createdBy,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.invitations.set(token, invitation);
    this.logger.log(`Invitation ${token} created for team ${dto.teamId}`);

    return {
      token,
      inviteLink: `/api/v1/invitations/${token}/accept`,
      expiresAt: invitation.expiresAt,
      teamId: dto.teamId,
      role,
      email: dto.email,
    };
  }

  /**
   * Accept an invitation using its token.
   * Adds the accepting user as a member of both the tenant and the team.
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = this.invitations.get(token);
    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }
    if (invitation.expiresAt < new Date()) {
      this.invitations.delete(token);
      throw new BadRequestException('Invitation has expired');
    }

    // Check email match if email was specified
    if (invitation.email) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user || user.email !== invitation.email) {
        throw new BadRequestException(
          'This invitation was sent to a different email address',
        );
      }
    }

    // Add user as tenant member and team member in a transaction (Finding 7)
    let teamMember;
    await this.prisma.$transaction(async (tx) => {
      const existingTenantMember = await tx.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId: invitation.tenantId,
          },
        },
      });

      if (!existingTenantMember) {
        await tx.tenantMember.create({
          data: {
            userId,
            tenantId: invitation.tenantId,
            role: invitation.role,
          },
        });
      }

      const existingTeamMember = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: invitation.teamId,
            userId,
          },
        },
      });

      if (!existingTeamMember) {
        teamMember = await tx.teamMember.create({
          data: {
            teamId: invitation.teamId,
            userId,
            role: invitation.role,
          },
          include: {
            team: {
              select: { id: true, name: true },
            },
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
      } else {
        teamMember = existingTeamMember;
      }
    });

    // Consume the invitation (single-use)
    this.invitations.delete(token);
    this.logger.log(`Invitation ${token} accepted by user ${userId}`);

    return teamMember!;
  }

  // ── Freeze / Unsubscribe (Enterprise) ────────────────────────

  /**
   * Freeze a tenant — disables all access by setting status to "frozen".
   * Only the tenant owner can freeze.
   */
  async freeze(id: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.ownerId !== userId) {
      throw new ForbiddenException('Only the tenant owner can freeze the enterprise');
    }

    if (tenant.status === 'frozen') {
      return { message: 'Enterprise is already frozen' };
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { status: 'frozen' },
    });

    this.logger.log(`Tenant ${id} frozen by user ${userId}`);
    return { message: 'Enterprise has been frozen. All access is suspended.' };
  }

  /**
   * Unfreeze a tenant — restores access by setting status to "active".
   * Only the tenant owner can unfreeze.
   */
  async unfreeze(id: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.ownerId !== userId) {
      throw new ForbiddenException('Only the tenant owner can unfreeze the enterprise');
    }

    if (tenant.status !== 'frozen') {
      return { message: 'Enterprise is not currently frozen' };
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { status: 'active' },
    });

    this.logger.log(`Tenant ${id} unfrozen by user ${userId}`);
    return { message: 'Enterprise has been unfrozen and access restored.' };
  }

  /**
   * Unsubscribe / delete a tenant (soft-delete).
   * Only the tenant owner can unsubscribe.
   */
  async unsubscribe(id: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.ownerId !== userId) {
      throw new ForbiddenException('Only the tenant owner can unsubscribe');
    }

    // Soft-delete the tenant
    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'deleted' },
    });

    this.logger.log(`Tenant ${id} unsubscribed (soft-deleted) by user ${userId}`);
    return { message: 'Enterprise has been unsubscribed.' };
  }

  // ── Quota Management ───────────────────────────────────────

  /**
   * Get the current quota usage for a tenant.
   */
  async getQuota(id: string): Promise<TenantQuota> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    const [memberCount, teamCount, storageItems] = await Promise.all([
      this.prisma.tenantMember.count({ where: { tenantId: id } }),
      this.prisma.team.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.document.aggregate({
        where: { team: { tenantId: id }, deletedAt: null },
        _sum: { fileSize: true },
      }),
    ]);

    // Default quotas (could be overridden per plan)
    const maxMembers = 100;
    const maxStorageMb = 1024; // 1 GB
    const maxTeams = 20;

    return new TenantQuota({
      maxMembers,
      maxStorageMb,
      maxTeams,
      usedMembers: memberCount,
      usedStorageMb: Math.round((storageItems._sum.fileSize ?? 0) / (1024 * 1024)),
      usedTeams: teamCount,
    });
  }

  /**
   * Update quota limits for a tenant.
   * Only the tenant owner can update quotas.
   */
  async updateQuota(id: string, userId: string, dto: UpdateQuotaDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.ownerId !== userId) {
      throw new ForbiddenException('Only the tenant owner can update quotas');
    }

    // In production, quotas would be persisted in a tenant_quotas table.
    // For now, we log the change and return success.
    this.logger.log(`Quota updated for tenant ${id}: ${JSON.stringify(dto)}`);

    return {
      message: 'Quota updated successfully',
      quotas: dto,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private randomId(): string {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10)
    );
  }
}
