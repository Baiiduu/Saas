import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TeamService } from './team.service';
import { BatchInviteDto } from '../tenant/dto/batch-invite.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JoinRequestDto } from './dto/join-request.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('Team')
@ApiBearerAuth('access-token')
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ── CRUD ────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new team within a tenant' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID the team belongs to' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Team name already exists in this tenant' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.create(user.sub, tenantId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List teams, optionally filtered by tenant' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant ID' })
  @ApiResponse({ status: 200, description: 'List of teams returned' })
  async findAll(@Query('tenantId') tenantId?: string) {
    return this.teamService.findAll(tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get team by ID with members' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team returned' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async findById(@Param('id') id: string) {
    return this.teamService.findById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update team properties' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team updated' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 204, description: 'Team deleted' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.teamService.delete(id, user.sub);
  }

  // ── Archive ─────────────────────────────────────────────────

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive or unarchive a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { isArchived: { type: 'boolean' } },
      required: ['isArchived'],
    },
  })
  @ApiResponse({ status: 200, description: 'Team archive status updated' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async archive(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('isArchived') isArchived: boolean,
  ) {
    return this.teamService.archive(id, isArchived, user.sub);
  }

  // ── Visibility toggle ──────────────────────────────────────

  @Patch(':id/visibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle team visibility (PUBLIC/PRIVATE)' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] } },
      required: ['visibility'],
    },
  })
  @ApiResponse({ status: 200, description: 'Team visibility updated' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async setVisibility(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('visibility') visibility: 'PUBLIC' | 'PRIVATE',
  ) {
    return this.teamService.setVisibility(id, visibility, user.sub);
  }

  // ── Members ─────────────────────────────────────────────────

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all team members' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Members returned' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getMembers(@Param('id') id: string) {
    return this.teamService.getMembers(id);
  }

  @Get(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific team member' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Member returned' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  async getMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teamService.getMember(id, userId);
  }

  @Post(':id/members/:userId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to the team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'userId', description: 'User ID to add' })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async addMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.teamService.addMember(id, userId, dto, user.sub);
  }

  @Patch(':id/members/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a member role in the team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  async updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(id, userId, dto.role, user.sub);
  }

  // ── Join Requests ───────────────────────────────────────────

  @Post(':id/join-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a join request for a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 201, description: 'Join request created' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 409, description: 'Already a member or pending request exists' })
  async createJoinRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: JoinRequestDto,
  ) {
    return this.teamService.createJoinRequest(id, user.sub, dto);
  }

  @Get(':id/join-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List join requests for a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Join requests returned' })
  async getJoinRequests(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.teamService.getJoinRequests(id, user.sub);
  }

  @Patch(':id/join-requests/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a join request' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'requestId', description: 'Join request ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['APPROVED', 'REJECTED'] } },
      required: ['action'],
    },
  })
  @ApiResponse({ status: 200, description: 'Join request processed' })
  @ApiResponse({ status: 404, description: 'Team or request not found' })
  async processJoinRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body('action') action: 'APPROVED' | 'REJECTED',
  ) {
    return this.teamService.processJoinRequest(id, requestId, action, user.sub);
  }

  // ── Batch Invite ────────────────────────────────────────────

  @Post(':id/invitations/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch invite members to a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Batch invite processed' })
  async batchInvite(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BatchInviteDto,
  ) {
    return this.teamService.batchInvite(id, dto, user.sub);
  }

  // ── Leave / Remove ─────────────────────────────────────────

  @Delete(':id/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a team (remove self)' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 204, description: 'Left the team' })
  @ApiResponse({ status: 404, description: 'Not a member' })
  async leaveTeam(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.teamService.leaveTeam(id, user.sub);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the team (admin/owner only)' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  async removeMemberWithCheck(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.teamService.removeMemberWithCheck(id, userId, user.sub);
  }
}
