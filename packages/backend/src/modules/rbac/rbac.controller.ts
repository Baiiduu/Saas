import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Role } from '@saas/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { RBAC } from '../../common/decorators/rbac.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RbacService } from './rbac.service';

// ── Request body types (inline, not shared) ─────────────────

class CheckPermissionBody {
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @IsString()
  @IsNotEmpty()
  operation!: string;

  resourceId?: string;
  teamId?: string;
}

class CheckPermissionResponse {
  allowed!: boolean;
}

@ApiTags('RBAC / Permissions')
@ApiBearerAuth('access-token')
@Controller({ path: 'rbac', version: '1' })
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ── POST /api/v1/rbac/check ────────────────────────────────
  /**
   * Check whether the current user has a specific permission.
   * Useful for front-end feature toggles and conditional rendering.
   * The caller must be authenticated (JWT guard).
   */
  @Post('check')
  @ApiOperation({
    summary: 'Check current user permission',
    description:
      'Returns whether the authenticated user has the specified operation on the given resource type. Optionally checks resource-level overrides (e.g. doc_shares).',
  })
  @ApiBody({ type: CheckPermissionBody })
  @ApiResponse({
    status: 200,
    description: 'Permission check result',
    type: CheckPermissionResponse,
  })
  async checkPermission(
    @Req() req: any,
    @Body() body: CheckPermissionBody,
  ): Promise<CheckPermissionResponse> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const allowed = await this.rbacService.checkPermission(
      userId,
      body.resourceType,
      body.operation,
      { resourceId: body.resourceId, teamId: body.teamId },
    );

    return { allowed };
  }

  // ── GET /api/v1/rbac/permissions/:userId ───────────────────
  /**
   * Get the effective permissions for a given user.
   * Only ADMIN and OWNER can inspect another user's permissions.
   */
  @Get('permissions/:userId')
  @ApiOperation({
    summary: 'Get effective permissions for a user (self-service or ADMIN/OWNER)',
    description:
      'Returns a flat map of resourceType.operation → boolean for the specified user. Self-service is always allowed; inspecting another user requires ADMIN or OWNER role.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Effective permission map',
  })
  async getUserPermissions(
    @Req() req: any,
    @Param('userId') userId: string,
  ): Promise<{ userId: string; permissions: Record<string, boolean> }> {
    // Self-service is always allowed
    const currentUserId = req.user?.sub;
    if (currentUserId !== userId) {
      // Non-self check — RBAC decorator above ensures ADMIN/OWNER
      // but do a secondary explicit check for safety.
      await this.rbacService.requireRole(currentUserId, [Role.ADMIN, Role.OWNER]);
    }

    const permissions = await this.rbacService.getUserEffectivePermissions(userId);
    return { userId, permissions };
  }

  // ── GET /api/v1/rbac/roles ────────────────────────────────
  /**
   * List all available roles with their hierarchy level.
   * Any authenticated user can view the role definitions.
   */
  @Get('roles')
  @ApiOperation({
    summary: 'List available roles with hierarchy',
    description: 'Returns all role definitions sorted by privilege level (descending).',
  })
  @ApiResponse({
    status: 200,
    description: 'Role definitions',
  })
  async listRoles(): Promise<{ roles: Array<{ role: string; level: number }> }> {
    const roles = this.rbacService.getRoleDefinitions();
    return { roles: roles.map((r) => ({ role: r.role, level: r.level })) };
  }

  // ── POST /api/v1/rbac/users/:userId/role ──────────────────
  /**
   * Assign or change a user's role (tenant or team level).
   * Requires ADMIN or OWNER role.
   */
  @Post('users/:userId/role')
  @RBAC(Role.ADMIN, Role.OWNER)
  @ApiOperation({
    summary: 'Assign or change a user role',
    description:
      'Updates the role for a user at the tenant level (default) or team level (if teamId is provided). Requires ADMIN or OWNER.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiBody({ type: AssignRoleDto })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to assign role' })
  async assignRole(
    @Req() req: any,
    @Param('userId') targetUserId: string,
    @Body() dto: AssignRoleDto,
  ): Promise<{ message: string }> {
    const currentUserId = req.user?.sub;
    const tenantId = req.tenantId;

    // ── Role assignment guards ──────────────────────────

    // 0. Force ADMIN/OWNER gate even when RbacGuard is in non-strict mode
    await this.rbacService.requireRole(currentUserId, [Role.ADMIN, Role.OWNER]);

    // 1. Resolve the caller's role once (reused by multiple checks)
    const assignerRole = await this.rbacService.getUserHighestRole(currentUserId);

    // 2. Owners cannot be demoted by non-owners — check the target's current role
    const targetTenantRole = await this.rbacService.getUserTenantRole(targetUserId);
    if (targetTenantRole === Role.OWNER && assignerRole !== Role.OWNER) {
      throw new ForbiddenException('Only the tenant owner can change the role of an owner');
    }

    // 3. Only OWNER can assign the OWNER role
    if (dto.role === Role.OWNER && assignerRole !== Role.OWNER) {
      throw new ForbiddenException('Only the tenant owner can assign the OWNER role');
    }

    // 4. Non-owners cannot assign roles with higher privileges than their own level
    const targetRoleLevel = this.rbacService.getRoleLevel(dto.role);
    const assignerLevel = assignerRole ? this.rbacService.getRoleLevel(assignerRole) : 0;

    if (assignerLevel < targetRoleLevel && assignerRole !== Role.OWNER) {
      throw new ForbiddenException(
        'You cannot assign a role with higher privileges than your own',
      );
    }

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    await this.rbacService.assignRole(targetUserId, dto.role, tenantId, dto.teamId);

    return { message: `Role ${dto.role} assigned successfully` };
  }
}
