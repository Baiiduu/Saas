import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

// Higher number = more privileges.
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 100,
  [Role.ADMIN]: 80,
  [Role.LEADER]: 60,
  [Role.MEMBER]: 40,
  [Role.READER]: 20,
  [Role.GUEST]: 10,
};

const LEVEL_TO_ROLE: Record<number, Role> = {
  100: Role.OWNER,
  80: Role.ADMIN,
  60: Role.LEADER,
  40: Role.MEMBER,
  20: Role.READER,
  10: Role.GUEST,
};

const PERMISSION_MATRIX: Record<string, Partial<Record<string, Role>>> = {
  task: {
    create: Role.MEMBER,
    read: Role.READER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  document: {
    create: Role.MEMBER,
    read: Role.READER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.ADMIN,
    assign: Role.MEMBER,
    approve: Role.LEADER,
    share: Role.MEMBER,
  },
  approval: {
    create: Role.MEMBER,
    read: Role.READER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.LEADER,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  team: {
    create: Role.ADMIN,
    read: Role.READER,
    update: Role.LEADER,
    delete: Role.OWNER,
    manage: Role.ADMIN,
    assign: Role.ADMIN,
    approve: Role.ADMIN,
  },
  member: {
    create: Role.LEADER,
    read: Role.READER,
    update: Role.LEADER,
    delete: Role.LEADER,
    manage: Role.LEADER,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  tenant: {
    create: Role.OWNER,
    read: Role.READER,
    update: Role.ADMIN,
    delete: Role.OWNER,
    manage: Role.OWNER,
    assign: Role.OWNER,
    approve: Role.OWNER,
    invite: Role.ADMIN,
  },
  board: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.LEADER,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  comment: {
    create: Role.MEMBER,
    read: Role.READER,
    update: Role.MEMBER,
    delete: Role.MEMBER,
    manage: Role.ADMIN,
    assign: Role.MEMBER,
    approve: Role.LEADER,
  },
  notification: {
    create: Role.MEMBER,
    read: Role.MEMBER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.LEADER,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  dashboard: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.LEADER,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  message: {
    create: Role.MEMBER,
    read: Role.MEMBER,
    update: Role.MEMBER,
    delete: Role.MEMBER,
    manage: Role.LEADER,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  milestone: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.LEADER,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  resource: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.LEADER,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  graph: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.LEADER,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.ADMIN,
  },
  audit: {
    create: Role.ADMIN,
    read: Role.ADMIN,
    update: Role.ADMIN,
    delete: Role.OWNER,
    manage: Role.OWNER,
    assign: Role.ADMIN,
    approve: Role.ADMIN,
  },
  rbac: {
    create: Role.ADMIN,
    read: Role.MEMBER,
    update: Role.ADMIN,
    delete: Role.ADMIN,
    manage: Role.OWNER,
    assign: Role.ADMIN,
    approve: Role.ADMIN,
  },
  llm: {
    create: Role.MEMBER,
    read: Role.MEMBER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
};

const PERMISSION_ALIASES: Record<string, string> = {
  'task.view': 'task.read',
  'document.view': 'document.read',
  'approval.view': 'approval.read',
  'notification.view': 'notification.read',
  'message.view': 'message.read',
  'message.send': 'message.create',
  'resource.view': 'resource.read',
  'milestone.view': 'milestone.read',
  'dashboard.view': 'dashboard.read',
  'audit.view': 'audit.read',
  'team.add_member': 'member.create',
  'team.remove_member': 'member.delete',
  'team.update_member_role': 'member.update',
  'tenant.invite': 'tenant.invite',
};

export interface UserRolesResult {
  tenantRole: Role | null;
  teamRoles: Array<{ teamId: string; role: Role }>;
}

export interface CheckPermissionOptions {
  resourceId?: string;
  teamId?: string;
  tenantId?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  permission: string;
  resourceType: string;
  operation: string;
  effectiveRole: Role | null;
  tenantRole: Role | null;
  teamId?: string;
  resourceId?: string;
  viaShare?: boolean;
  reason?: string;
}

export interface PermissionEvaluationOptions {
  teamId?: string;
  resourceId?: string;
  shareToken?: string;
  accessCode?: string;
  allowDocumentShare?: boolean;
  ownership?: 'creator' | 'creator_or_assignee';
}

type ResolvedResourceContext = {
  id: string;
  tenantId: string;
  teamId?: string;
  creatorId?: string;
  assigneeIds?: string[];
};

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  getRoleLevel(role: Role): number {
    return ROLE_HIERARCHY[role] ?? 0;
  }

  getRoleFromLevel(level: number): Role | null {
    return LEVEL_TO_ROLE[level] ?? null;
  }

  async getUserHighestRole(userId: string): Promise<Role | null> {
    const roles = await this.getUserRoles(userId);
    return this.getHighestRole(roles);
  }

  async getUserTeamRole(userId: string, teamId: string): Promise<Role | null> {
    const tm = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (tm) {
      return tm.role as unknown as Role;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { tenantId: true, deletedAt: true },
    });

    if (!team || team.deletedAt) {
      return null;
    }

    return this.getTenantRoleInTenant(userId, team.tenantId);
  }

  async getUserTenantRole(userId: string, tenantId?: string): Promise<Role | null> {
    if (tenantId) {
      return this.getTenantRoleInTenant(userId, tenantId);
    }

    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      take: 1,
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.length > 0 ? (memberships[0].role as unknown as Role) : null;
  }

  async getUserRoles(userId: string): Promise<UserRolesResult> {
    const tenantMembership = await this.prisma.tenantMember.findMany({
      where: { userId },
      take: 1,
      orderBy: { joinedAt: 'desc' },
    });

    const teamMemberships = await this.prisma.teamMember.findMany({
      where: { userId },
    });

    return {
      tenantRole: tenantMembership.length > 0 ? (tenantMembership[0].role as unknown as Role) : null,
      teamRoles: teamMemberships.map((membership) => ({
        teamId: membership.teamId,
        role: membership.role as unknown as Role,
      })),
    };
  }

  async checkPermission(
    userId: string,
    resourceType: string,
    operation: string,
    options?: CheckPermissionOptions,
  ): Promise<boolean> {
    if (options?.tenantId) {
      const decision = await this.evaluatePermission(
        userId,
        options.tenantId,
        `${resourceType}.${operation}`,
        {
          resourceId: options.resourceId,
          teamId: options.teamId,
          allowDocumentShare: resourceType === 'document' && operation === 'read',
        },
      );
      return decision.allowed;
    }

    const minRole = this.getMinimumRequiredRole(resourceType, operation);
    if (!minRole) {
      this.logger.warn(`No permission entry for ${resourceType}.${operation}`);
      return false;
    }

    const userRole = await this.getUserHighestRole(userId);
    if (!userRole) {
      return false;
    }

    if (this.getRoleLevel(userRole) >= this.getRoleLevel(minRole)) {
      return true;
    }

    if (options?.resourceId && resourceType === 'document' && operation === 'read') {
      return this.checkDocShareOverride(options.resourceId);
    }

    return false;
  }

  async canAccessPermission(
    permission: string,
    userId: string,
    tenantId: string,
    options?: PermissionEvaluationOptions,
  ): Promise<boolean> {
    const decision = await this.evaluatePermission(userId, tenantId, permission, options);
    return decision.allowed;
  }

  async assertPermission(
    permission: string,
    userId: string,
    tenantId: string,
    options?: PermissionEvaluationOptions,
  ): Promise<PermissionDecision> {
    const decision = await this.evaluatePermission(userId, tenantId, permission, options);
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason ?? `Permission ${decision.permission} denied`);
    }
    return decision;
  }

  async assertTenantAccess(userId: string, tenantId: string): Promise<Role> {
    const tenantRole = await this.getTenantRoleInTenant(userId, tenantId);
    if (!tenantRole) {
      throw new ForbiddenException('You are not a member of the current tenant');
    }
    return tenantRole;
  }

  async getTenantRoleInTenant(userId: string, tenantId: string): Promise<Role | null> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: { role: true },
    });

    return (membership?.role as Role | undefined) ?? null;
  }

  async getEffectiveTeamRole(
    userId: string,
    tenantId: string,
    teamId: string,
  ): Promise<Role | null> {
    const team = await this.findActiveTeam(teamId);
    if (!team || team.tenantId !== tenantId) {
      return null;
    }

    const tenantRole = await this.getTenantRoleInTenant(userId, tenantId);
    if (!tenantRole) {
      return null;
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    });

    const teamRole = (membership?.role as Role | undefined) ?? null;
    if (teamRole) {
      return this.getRoleLevel(teamRole) >= this.getRoleLevel(tenantRole)
        ? teamRole
        : tenantRole;
    }

    if (tenantRole === Role.OWNER || tenantRole === Role.ADMIN) {
      return tenantRole;
    }

    return null;
  }

  async hasRole(userId: string, requiredRoles: Role[]): Promise<boolean> {
    const highest = await this.getUserHighestRole(userId);
    if (!highest) {
      return false;
    }

    const userLevel = this.getRoleLevel(highest);
    const minRequiredLevel = Math.min(...requiredRoles.map((role) => this.getRoleLevel(role)));
    return userLevel >= minRequiredLevel;
  }

  async hasTenantRole(
    userId: string,
    tenantId: string,
    requiredRoles: Role[],
    teamId?: string,
  ): Promise<boolean> {
    const effectiveRole = teamId
      ? await this.getEffectiveTeamRole(userId, tenantId, teamId)
      : await this.getTenantRoleInTenant(userId, tenantId);

    if (!effectiveRole) {
      return false;
    }

    const userLevel = this.getRoleLevel(effectiveRole);
    const minRequiredLevel = Math.min(...requiredRoles.map((role) => this.getRoleLevel(role)));
    return userLevel >= minRequiredLevel;
  }

  async requireRole(userId: string, requiredRoles: Role[]): Promise<void> {
    const hasAccess = await this.hasRole(userId, requiredRoles);
    if (!hasAccess) {
      throw new ForbiddenException(`Insufficient role. Required: [${requiredRoles.join(', ')}]`);
    }
  }

  async requireTenantRole(
    userId: string,
    tenantId: string,
    requiredRoles: Role[],
    teamId?: string,
  ): Promise<void> {
    const hasAccess = await this.hasTenantRole(userId, tenantId, requiredRoles, teamId);
    if (!hasAccess) {
      throw new ForbiddenException(`Insufficient role. Required: [${requiredRoles.join(', ')}]`);
    }
  }

  async listAccessibleTeamIds(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<string[]> {
    const [resourceType, operation] = this.parsePermission(permission);
    const minRole = this.getMinimumRequiredRole(resourceType, operation);
    if (!minRole) {
      return [];
    }

    const tenantRole = await this.getTenantRoleInTenant(userId, tenantId);
    if (!tenantRole) {
      return [];
    }

    if (tenantRole === Role.OWNER || tenantRole === Role.ADMIN) {
      const teams = await this.prisma.team.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true },
      });
      return teams.map((team) => team.id);
    }

    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        team: {
          tenantId,
          deletedAt: null,
        },
      },
      select: {
        teamId: true,
        role: true,
      },
    });

    const minLevel = this.getRoleLevel(minRole);
    return memberships
      .filter((membership) => this.getRoleLevel(membership.role as unknown as Role) >= minLevel)
      .map((membership) => membership.teamId);
  }

  async getUserEffectivePermissions(
    userId: string,
    tenantId?: string,
    teamId?: string,
  ): Promise<Record<string, boolean>> {
    const role = tenantId
      ? (teamId
          ? await this.getEffectiveTeamRole(userId, tenantId, teamId)
          : await this.getTenantRoleInTenant(userId, tenantId))
      : await this.getUserHighestRole(userId);

    if (!role) {
      return {};
    }

    const userLevel = this.getRoleLevel(role);
    const result: Record<string, boolean> = {};

    for (const [resourceType, operations] of Object.entries(PERMISSION_MATRIX)) {
      for (const [operation, minRole] of Object.entries(operations)) {
        const key = `${resourceType}.${operation}`;
        result[key] = userLevel >= this.getRoleLevel(minRole as Role);
      }
    }

    for (const [alias, canonical] of Object.entries(PERMISSION_ALIASES)) {
      result[alias] = result[canonical] ?? false;
    }

    return result;
  }

  async checkApprovalTemplateScope(userId: string, templateId: string): Promise<boolean> {
    const template = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return false;
    }

    const { scope } = template;
    if (scope === 'tenant') {
      return true;
    }

    if (scope.startsWith('team:')) {
      const teamId = scope.slice(5);
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      return !!membership;
    }

    if (scope.startsWith('user:')) {
      const targetUserId = scope.slice(5);
      return targetUserId === userId || template.createdBy === userId;
    }

    return false;
  }

  getMinimumRequiredRole(resourceType: string, operation: string): Role | null {
    const resourcePerms = PERMISSION_MATRIX[resourceType];
    if (!resourcePerms) {
      return null;
    }

    return (resourcePerms[operation] as Role) ?? null;
  }

  getMinimumRequiredRoleForPermission(permission: string): Role | null {
    const [resourceType, operation] = this.parsePermission(permission);
    return this.getMinimumRequiredRole(resourceType, operation);
  }

  getPermissionMatrix(): Record<string, Partial<Record<string, Role>>> {
    return { ...PERMISSION_MATRIX };
  }

  getRoleDefinitions(): Array<{ role: Role; level: number }> {
    return Object.entries(ROLE_HIERARCHY)
      .map(([role, level]) => ({ role: role as Role, level }))
      .sort((left, right) => right.level - left.level);
  }

  async assignRole(
    targetUserId: string,
    role: Role,
    tenantId: string,
    teamId?: string,
  ): Promise<void> {
    if (teamId) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: targetUserId } },
        update: { role },
        create: {
          teamId,
          userId: targetUserId,
          role,
        },
      });
      this.logger.log(`Assigned role ${role} to user ${targetUserId} in team ${teamId}`);
      return;
    }

    await this.prisma.tenantMember.upsert({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
      update: { role },
      create: {
        userId: targetUserId,
        tenantId,
        role,
      },
    });

    this.logger.log(`Assigned role ${role} to user ${targetUserId} in tenant ${tenantId}`);
  }

  private async evaluatePermission(
    userId: string,
    tenantId: string,
    permission: string,
    options?: PermissionEvaluationOptions,
  ): Promise<PermissionDecision> {
    const normalizedPermission = this.normalizePermission(permission);
    const [resourceType, operation] = this.parsePermission(normalizedPermission);
    const requiredRole = this.getMinimumRequiredRole(resourceType, operation);
    if (!requiredRole) {
      return {
        allowed: false,
        permission: normalizedPermission,
        resourceType,
        operation,
        effectiveRole: null,
        tenantRole: null,
        resourceId: options?.resourceId,
        reason: `Unsupported permission scope: ${normalizedPermission}`,
      };
    }

    const tenantRole = await this.getTenantRoleInTenant(userId, tenantId);
    if (!tenantRole) {
      return {
        allowed: false,
        permission: normalizedPermission,
        resourceType,
        operation,
        effectiveRole: null,
        tenantRole: null,
        resourceId: options?.resourceId,
        reason: 'User is not a member of the current tenant',
      };
    }

    const resourceContext = options?.resourceId
      ? await this.resolveResourceContext(resourceType, options.resourceId)
      : null;

    if (options?.resourceId && !resourceContext) {
      throw new NotFoundException(`${resourceType} resource not found`);
    }

    if (resourceContext?.tenantId && resourceContext.tenantId !== tenantId) {
      return {
        allowed: false,
        permission: normalizedPermission,
        resourceType,
        operation,
        effectiveRole: null,
        tenantRole,
        teamId: resourceContext.teamId,
        resourceId: resourceContext.id,
        reason: 'Cross-tenant resource access is not allowed',
      };
    }

    const resolvedTeamId = options?.teamId ?? resourceContext?.teamId;
    if (resolvedTeamId) {
      const team = await this.findActiveTeam(resolvedTeamId);
      if (!team) {
        throw new NotFoundException('Team not found');
      }
      if (team.tenantId !== tenantId) {
        return {
          allowed: false,
          permission: normalizedPermission,
          resourceType,
          operation,
          effectiveRole: null,
          tenantRole,
          teamId: resolvedTeamId,
          resourceId: options?.resourceId,
          reason: 'Cross-tenant team access is not allowed',
        };
      }
    }

    const effectiveRole = resolvedTeamId
      ? await this.getEffectiveTeamRole(userId, tenantId, resolvedTeamId)
      : tenantRole;

    if (
      (!effectiveRole || this.getRoleLevel(effectiveRole) < this.getRoleLevel(requiredRole)) &&
      resourceType === 'document' &&
      options?.allowDocumentShare &&
      options.shareToken
    ) {
      const share = await this.getValidDocumentShare(options.shareToken, options.accessCode);
      if (
        share &&
        (!resourceContext || share.documentId === resourceContext.id) &&
        this.shareAllowsOperation(share.permission, operation)
      ) {
        return {
          allowed: true,
          permission: normalizedPermission,
          resourceType,
          operation,
          effectiveRole,
          tenantRole,
          teamId: resolvedTeamId,
          resourceId: options.resourceId,
          viaShare: true,
        };
      }
    }

    if (!effectiveRole) {
      return {
        allowed: false,
        permission: normalizedPermission,
        resourceType,
        operation,
        effectiveRole: null,
        tenantRole,
        teamId: resolvedTeamId,
        resourceId: options?.resourceId,
        reason: 'User has no effective role in the target team',
      };
    }

    if (this.getRoleLevel(effectiveRole) < this.getRoleLevel(requiredRole)) {
      return {
        allowed: false,
        permission: normalizedPermission,
        resourceType,
        operation,
        effectiveRole,
        tenantRole,
        teamId: resolvedTeamId,
        resourceId: options?.resourceId,
        reason: `Permission ${normalizedPermission} requires role ${requiredRole}`,
      };
    }

    if (options?.ownership && resourceContext) {
      const bypassOwnership = this.getRoleLevel(effectiveRole) >= this.getRoleLevel(Role.LEADER);
      if (!bypassOwnership) {
        const ownsResource = resourceContext.creatorId === userId;
        const isAssignee = resourceContext.assigneeIds?.includes(userId) ?? false;

        if (options.ownership === 'creator' && !ownsResource) {
          return {
            allowed: false,
            permission: normalizedPermission,
            resourceType,
            operation,
            effectiveRole,
            tenantRole,
            teamId: resolvedTeamId,
            resourceId: resourceContext.id,
            reason: 'Only the resource creator can perform this action',
          };
        }

        if (options.ownership === 'creator_or_assignee' && !ownsResource && !isAssignee) {
          return {
            allowed: false,
            permission: normalizedPermission,
            resourceType,
            operation,
            effectiveRole,
            tenantRole,
            teamId: resolvedTeamId,
            resourceId: resourceContext.id,
            reason: 'Only the resource creator or assignee can perform this action',
          };
        }
      }
    }

    return {
      allowed: true,
      permission: normalizedPermission,
      resourceType,
      operation,
      effectiveRole,
      tenantRole,
      teamId: resolvedTeamId,
      resourceId: options?.resourceId,
    };
  }

  private normalizePermission(permission: string): string {
    const normalized = permission.replace(':', '.');
    return PERMISSION_ALIASES[normalized] ?? normalized;
  }

  private parsePermission(permission: string): [string, string] {
    const normalized = this.normalizePermission(permission);
    const [resourceType = '', operation = ''] = normalized.split('.');
    return [resourceType, operation];
  }

  private async checkDocShareOverride(documentId: string): Promise<boolean> {
    const share = await this.prisma.docShare.findFirst({
      where: {
        documentId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
    });

    return !!share;
  }

  private async getValidDocumentShare(shareToken: string, accessCode?: string) {
    const share = await this.prisma.docShare.findUnique({
      where: { shareToken },
      select: {
        documentId: true,
        permission: true,
        accessCode: true,
        expiresAt: true,
      },
    });

    if (!share) {
      return null;
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return null;
    }

    if (share.accessCode && share.accessCode !== accessCode) {
      return null;
    }

    return share;
  }

  private shareAllowsOperation(permission: string, operation: string): boolean {
    if (operation === 'read') {
      return ['view', 'comment', 'edit'].includes(permission);
    }

    if (operation === 'update') {
      return permission === 'edit';
    }

    return false;
  }

  private async resolveResourceContext(
    resourceType: string,
    resourceId: string,
  ): Promise<ResolvedResourceContext | null> {
    if (resourceType === 'task') {
      const task = await this.prisma.task.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          teamId: true,
          creatorId: true,
          deletedAt: true,
          assignees: {
            select: { userId: true },
          },
          team: {
            select: { tenantId: true, deletedAt: true },
          },
        },
      });

      if (!task || task.deletedAt || !task.team || task.team.deletedAt) {
        return null;
      }

      return {
        id: task.id,
        tenantId: task.team.tenantId,
        teamId: task.teamId,
        creatorId: task.creatorId,
        assigneeIds: task.assignees.map((assignee) => assignee.userId),
      };
    }

    if (resourceType === 'document') {
      const document = await this.prisma.document.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          teamId: true,
          creatorId: true,
          deletedAt: true,
          team: {
            select: { tenantId: true, deletedAt: true },
          },
        },
      });

      if (!document || document.deletedAt || !document.team || document.team.deletedAt) {
        return null;
      }

      return {
        id: document.id,
        tenantId: document.team.tenantId,
        teamId: document.teamId,
        creatorId: document.creatorId,
      };
    }

    if (resourceType === 'approval') {
      const approval = await this.prisma.approval.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          teamId: true,
          creatorId: true,
          deletedAt: true,
          team: {
            select: { tenantId: true, deletedAt: true },
          },
        },
      });

      if (!approval || approval.deletedAt || !approval.team || approval.team.deletedAt) {
        return null;
      }

      return {
        id: approval.id,
        tenantId: approval.team.tenantId,
        teamId: approval.teamId,
        creatorId: approval.creatorId,
      };
    }

    if (resourceType === 'team') {
      const team = await this.prisma.team.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          tenantId: true,
          createdBy: true,
          deletedAt: true,
        },
      });

      if (!team || team.deletedAt) {
        return null;
      }

      return {
        id: team.id,
        tenantId: team.tenantId,
        teamId: team.id,
        creatorId: team.createdBy,
      };
    }

    if (resourceType === 'milestone') {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          teamId: true,
          createdBy: true,
          deletedAt: true,
          team: {
            select: { tenantId: true, deletedAt: true },
          },
        },
      });

      if (!milestone || milestone.deletedAt || !milestone.team || milestone.team.deletedAt) {
        return null;
      }

      return {
        id: milestone.id,
        tenantId: milestone.team.tenantId,
        teamId: milestone.teamId,
        creatorId: milestone.createdBy,
      };
    }

    return null;
  }

  private async findActiveTeam(teamId: string): Promise<{ tenantId: string } | null> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        tenantId: true,
        deletedAt: true,
      },
    });

    if (!team || team.deletedAt) {
      return null;
    }

    return {
      tenantId: team.tenantId,
    };
  }

  private getHighestRole(roles: UserRolesResult): Role | null {
    let highest: Role | null = roles.tenantRole;

    for (const teamRole of roles.teamRoles) {
      if (!highest || this.getRoleLevel(teamRole.role) > this.getRoleLevel(highest)) {
        highest = teamRole.role;
      }
    }

    return highest;
  }
}
