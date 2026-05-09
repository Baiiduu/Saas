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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantOptional } from '../../common/decorators/tenant-optional.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateQuotaDto } from './dto/quota.dto';

@ApiTags('Tenant')
@ApiBearerAuth('access-token')
@TenantOptional()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ── CRUD ────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new enterprise/tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 409, description: 'Tenant with this name already exists' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active tenants' })
  @ApiResponse({ status: 200, description: 'List of tenants returned' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.tenantService.findAll(user.sub);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant returned' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tenantService.findById(id, user.sub);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update enterprise/tenant information' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.update(id, user.sub, dto);
  }

  // ── Members ─────────────────────────────────────────────────

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all members of a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Members returned' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tenantService.getMembers(id, user.sub);
  }

  // ── Invitations ─────────────────────────────────────────────

  @Post(':id/invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invitation to join a team in the tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({ type: CreateInvitationDto })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  @ApiResponse({ status: 404, description: 'Tenant or team not found' })
  async createInvitation(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.tenantService.createInvitation(id, user.sub, dto);
  }

  // ── Freeze / Unsubscribe / Quota ─────────────────────────────

  @Post(':id/freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze enterprise (owner only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Enterprise frozen' })
  @ApiResponse({ status: 403, description: 'Not the tenant owner' })
  async freeze(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.freeze(id, user.sub);
  }

  @Post(':id/unfreeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfreeze enterprise (owner only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Enterprise unfrozen' })
  @ApiResponse({ status: 403, description: 'Not the tenant owner' })
  async unfreeze(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.unfreeze(id, user.sub);
  }

  @Delete(':id/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe / delete enterprise (owner only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Enterprise unsubscribed' })
  @ApiResponse({ status: 403, description: 'Not the tenant owner' })
  async unsubscribe(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.unsubscribe(id, user.sub);
  }

  @Get(':id/quota')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quota usage for the enterprise' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Quota info returned' })
  async getQuota(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tenantService.getQuota(id, user.sub);
  }

  @Patch(':id/quota')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update quota limits (owner only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({ type: UpdateQuotaDto })
  @ApiResponse({ status: 200, description: 'Quota updated' })
  @ApiResponse({ status: 403, description: 'Not the tenant owner' })
  async updateQuota(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateQuotaDto,
  ) {
    return this.tenantService.updateQuota(id, user.sub, dto);
  }
}

// Separate controller for invitation acceptance (outside /tenants scope)
@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@TenantOptional()
@Controller('invitations')
export class InvitationController {
  constructor(private readonly tenantService: TenantService) {}

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation using its token' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, user added to team' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.acceptInvitation(token, user.sub);
  }
}
