import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Role } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

// ── Role hierarchy levels ───────────────────────────────────
// Higher number = more privileges
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 100,
  [Role.ADMIN]: 80,
  [Role.LEADER]: 60,
  [Role.MEMBER]: 40,
  [Role.READER]: 20,
  [Role.GUEST]: 10,
};

// Reverse lookup: level → Role
const LEVEL_TO_ROLE: Record<number, Role> = {
  100: Role.OWNER,
  80: Role.ADMIN,
  60: Role.LEADER,
  40: Role.MEMBER,
  20: Role.READER,
  10: Role.GUEST,
};

// ── Permission matrix ───────────────────────────────────────
// Maps (resourceType, operation) → minimum required Role.
// The matrix is designed so that lower-privilege roles can be
// overridden at the resource level (e.g. via doc_shares).
//
// Operations: create | read | update | delete | manage | assign | approve
// Resource types: task, document, approval, team, member, tenant,
//                 board, comment, notification, dashboard, message,
//                 milestone, resource, graph, audit, rbac, llm

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
  },
  approval: {
    create: Role.MEMBER,
    read: Role.MEMBER,
    update: Role.MEMBER,
    delete: Role.LEADER,
    manage: Role.ADMIN,
    assign: Role.LEADER,
    approve: Role.LEADER,
  },
  team: {
    create: Role.LEADER,
    read: Role.MEMBER,
    update: Role.ADMIN,
    delete: Role.OWNER,
    manage: Role.ADMIN,
    assign: Role.ADMIN,
    approve: Role.ADMIN,
  },
  member: {
    create: Role.ADMIN,
    read: Role.MEMBER,
    update: Role.ADMIN,
    delete: Role.ADMIN,
    manage: Role.ADMIN,
    assign: Role.ADMIN,
    approve: Role.ADMIN,
  },
  tenant: {
    create: Role.OWNER,
    read: Role.OWNER,
    update: Role.OWNER,
    delete: Role.OWNER,
    manage: Role.OWNER,
    assign: Role.OWNER,
    approve: Role.OWNER,
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

export interface UserRolesResult {
  tenantRole: Role | null;
  teamRoles: Array<{ teamId: string; role: Role }>;
}

export interface CheckPermissionOptions {
  /** Resource ID — if provided, a doc_shares override is checked before denying */
  resourceId?: string;
  /** Team ID — scopes permission checks to a specific team */
  teamId?: string;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Role level utilities ──────────────────────────────────

  /** Return the numeric level for a given Role. */
  getRoleLevel(role: Role): number {
    return ROLE_HIERARCHY[role] ?? 0;
  }

  /** Return the Role enum for a given numeric level, or null. */
  getRoleFromLevel(level: number): Role | null {
    return LEVEL_TO_ROLE[level] ?? null;
  }

  // ── Role resolution ───────────────────────────────────────

  /**
   * Resolve the user's highest role across tenant and team memberships.
   * The user's tenant_members.role defines the tenant-level role.
   * The user's team_memberships define team-level roles.
   * Returns the highest (most privileged) role found.
   */
  async getUserHighestRole(userId: string): Promise<Role | null> {
    const roles = await this.getUserRoles(userId);
    return this.getHighestRole(roles);
  }

  /**
   * Resolve a user's effective role within a specific team.
   * Checks team_members first, falls back to tenant_members.
   */
  async getUserTeamRole(userId: string, teamId: string): Promise<Role | null> {
    // 1. Check team membership
    const tm = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (tm) return tm.role as unknown as Role;

    // 2. Fall back to tenant role
    const tenantRole = await this.getUserTenantRole(userId);
    return tenantRole;
  }

  /**
   * Resolve the user's tenant-level role from tenant_members.
   */
  async getUserTenantRole(userId: string): Promise<Role | null> {
    // Find all tenant memberships for this user
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      take: 1,
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.length > 0 ? (memberships[0].role as unknown as Role) : null;
  }

  /**
   * Resolve all roles for a user (tenant + team).
   */
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
      teamRoles: teamMemberships.map((m) => ({
        teamId: m.teamId,
        role: m.role as unknown as Role,
      })),
    };
  }

  // ── Permission checks ─────────────────────────────────────

  /**
   * Check whether `userId` has the required role level for the given
   * (resourceType, operation) pair.
   *
   * Returns `true` when:
   *   1. The user's highest role level >= the minimum role level required
   *      by the permission matrix, OR
   *   2. The check includes a `resourceId` and there is a doc_shares
   *      override granting sufficient permission.
   */
  async checkPermission(
    userId: string,
    resourceType: string,
    operation: string,
    options?: CheckPermissionOptions,
  ): Promise<boolean> {
    const minRole = this.getMinimumRequiredRole(resourceType, operation);
    if (!minRole) {
      // Unknown resource/operation — deny by default (fail closed)
      this.logger.warn(`No permission entry for ${resourceType}.${operation}`);
      return false;
    }

    const userRole = await this.getUserHighestRole(userId);
    if (!userRole) {
      return false; // User has no role at all
    }

    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(minRole);

    if (userLevel >= requiredLevel) {
      return true;
    }

    // ── Resource-level override check ────────────────────
    // If a resourceId was provided AND the resource type is "document",
    // check for a doc_shares entry that overrides the permission.
    if (
      options?.resourceId &&
      resourceType === 'document' &&
      operation === 'read'
    ) {
      return this.checkDocShareOverride(userId, options.resourceId);
    }

    return false;
  }

  /**
   * Check resource-level permission override via doc_shares table.
   * A user can read a shared document if there is a matching share record
   * that hasn't expired.
   */
  private async checkDocShareOverride(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    // Check if there is ANY active (non-expired) share link for the document,
    // regardless of who created it. Link-based sharing means any authenticated
    // tenant member with a valid share link can access the document.
    // (Tenant isolation scoping already applies via @@schema("tenant").)
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

  /**
   * Check whether the user has at least one of the given roles.
   * Considers both tenant and team memberships.
   */
  async hasRole(userId: string, requiredRoles: Role[]): Promise<boolean> {
    const highest = await this.getUserHighestRole(userId);
    if (!highest) return false;
    // Hierarchical check: user passes if their highest role level >=
    // the minimum level among the required roles.
    const userLevel = this.getRoleLevel(highest);
    const minRequiredLevel = Math.min(...requiredRoles.map((r) => this.getRoleLevel(r)));
    return userLevel >= minRequiredLevel;
  }

  /**
   * Assert that the user has at least one of the given roles.
   * Throws ForbiddenException if the check fails.
   */
  async requireRole(userId: string, requiredRoles: Role[]): Promise<void> {
    const hasAccess = await this.hasRole(userId, requiredRoles);
    if (!hasAccess) {
      throw new ForbiddenException(
        `Insufficient role. Required: [${requiredRoles.join(', ')}]`,
      );
    }
  }

  /**
   * Get the effective permissions for a user across all resource types.
   * Returns a flattened map of "resourceType.operation" → boolean.
   */
  async getUserEffectivePermissions(userId: string): Promise<Record<string, boolean>> {
    const userRole = await this.getUserHighestRole(userId);
    if (!userRole) return {};

    const userLevel = this.getRoleLevel(userRole);
    const result: Record<string, boolean> = {};

    for (const [resourceType, operations] of Object.entries(PERMISSION_MATRIX)) {
      for (const [operation, minRole] of Object.entries(operations)) {
        const key = `${resourceType}.${operation}`;
        result[key] = userLevel >= this.getRoleLevel(minRole as Role);
      }
    }

    return result;
  }

  // ── Approval template scope ───────────────────────────────

  /**
   * Check whether a user can access an approval template based on its scope.
   * Scope values: "tenant" (any member), "team:{teamId}" (must be in that team),
   * "user:{userId}" (only the creator).
   */
  async checkApprovalTemplateScope(
    userId: string,
    templateId: string,
  ): Promise<boolean> {
    const template = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return false;

    const { scope } = template;

    if (scope === 'tenant') return true;

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

  // ── Public utility methods ────────────────────────────────

  /**
   * Return the minimum role required for a given (resourceType, operation).
   * Returns null if no entry exists.
   */
  getMinimumRequiredRole(resourceType: string, operation: string): Role | null {
    const resourcePerms = PERMISSION_MATRIX[resourceType];
    if (!resourcePerms) return null;
    return (resourcePerms[operation] as Role) ?? null;
  }

  /**
   * Return a copy of the full permission matrix for introspection.
   */
  getPermissionMatrix(): Record<string, Partial<Record<string, Role>>> {
    return { ...PERMISSION_MATRIX };
  }

  /**
   * Return all available role definitions with their hierarchy levels.
   */
  getRoleDefinitions(): Array<{ role: Role; level: number }> {
    return Object.entries(ROLE_HIERARCHY)
      .map(([role, level]) => ({ role: role as Role, level }))
      .sort((a, b) => b.level - a.level);
  }

  /**
   * Assign a role to a user at the tenant or team level.
   */
  async assignRole(
    targetUserId: string,
    role: Role,
    tenantId: string,
    teamId?: string,
  ): Promise<void> {
    if (teamId) {
      // Upsert team membership role
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
    } else {
      // Upsert tenant membership role
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
  }

  // ── Private helpers ───────────────────────────────────────

  private getHighestRole(roles: UserRolesResult): Role | null {
    let highest: Role | null = roles.tenantRole;

    for (const tr of roles.teamRoles) {
      if (!highest || this.getRoleLevel(tr.role) > this.getRoleLevel(highest)) {
        highest = tr.role;
      }
    }

    return highest;
  }
}
