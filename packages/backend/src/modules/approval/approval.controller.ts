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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ApprovalService } from './approval.service';
import { ApprovalTimeoutService } from './approval-timeout.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ApprovalTimeoutConfigDto } from './dto/approval-timeout-config.dto';

@ApiTags('Approval')
@ApiBearerAuth('access-token')
@Controller()
export class ApprovalController {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly approvalTimeoutService: ApprovalTimeoutService,
  ) {}

  // ── Approval CRUD ────────────────────────────────────────────

  @Post('approvals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new approval (select template, fill form data)' })
  @ApiBody({ type: CreateApprovalDto })
  @ApiResponse({ status: 201, description: 'Approval created successfully' })
  @ApiResponse({ status: 404, description: 'Approval template not found' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvalService.create(user.sub, dto);
  }

  @Get('approvals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List approvals with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of approvals returned' })
  async findAll(@Query() query: QueryApprovalDto) {
    return this.approvalService.findAll(query);
  }

  @Get('approvals/:approvalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get approval detail with current node and action history' })
  @ApiParam({ name: 'approvalId', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Approval detail returned' })
  @ApiResponse({ status: 404, description: 'Approval not found' })
  async findById(@Param('approvalId') approvalId: string) {
    return this.approvalService.findById(approvalId);
  }

  // ── Templates ────────────────────────────────────────────────

  @Get('approval-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available approval templates (with seed data)' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Team ID used for seeding if no templates exist yet' })
  @ApiResponse({ status: 200, description: 'List of templates returned' })
  async getTemplates(
    @CurrentUser() user: JwtPayload,
    @Query('teamId') teamId?: string,
  ) {
    return this.approvalService.getTemplates(user.sub, teamId);
  }

  // ── Approval Actions ────────────────────────────────────────

  @Post('approvals/:approvalId/actions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process an approval action (approve / reject / return / redirect)' })
  @ApiParam({ name: 'approvalId', description: 'Approval ID' })
  @ApiBody({ type: ApprovalActionDto })
  @ApiResponse({ status: 200, description: 'Action processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid action or state' })
  @ApiResponse({ status: 404, description: 'Approval not found' })
  async processAction(
    @CurrentUser() user: JwtPayload,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalService.processAction(user.sub, approvalId, dto);
  }

  @Get('approvals/:approvalId/actions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get action history for an approval' })
  @ApiParam({ name: 'approvalId', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Action history returned' })
  @ApiResponse({ status: 404, description: 'Approval not found' })
  async getActionHistory(@Param('approvalId') approvalId: string) {
    return this.approvalService.getActionHistory(approvalId);
  }

  // ── Template Management ─────────────────────────────────────

  @Post('approval-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new approval template with nodes' })
  @ApiBody({ type: CreateTemplateDto })
  @ApiResponse({ status: 201, description: 'Template created' })
  @ApiResponse({ status: 400, description: 'Invalid template data' })
  async createTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.approvalService.createTemplate(user.sub, dto);
  }

  @Get('approval-templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get approval template detail' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template detail returned' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateById(@Param('templateId') templateId: string) {
    return this.approvalService.getTemplateById(templateId);
  }

  @Patch('approval-templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update approval template metadata' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: '请假申请' },
        description: { type: 'string', example: '员工请假审批流程' },
        scope: { type: 'string', example: 'attendance' },
        formFields: { type: 'object', example: { fields: [] } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() data: { name?: string; description?: string; scope?: string; formFields?: Record<string, any> },
  ) {
    return this.approvalService.updateTemplate(templateId, data);
  }

  @Delete('approval-templates/:templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an approval template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Param('templateId') templateId: string) {
    await this.approvalService.deleteTemplate(templateId);
  }

  // ── Timeout Reminder ────────────────────────────────────────

  @Post('approvals/check-timeouts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check and log timed-out approvals (simulated Bull cron)' })
  @ApiBody({ type: ApprovalTimeoutConfigDto, required: false })
  @ApiResponse({ status: 200, description: 'Timeout check completed' })
  async checkTimeouts(@Body() dto?: ApprovalTimeoutConfigDto) {
    return this.approvalTimeoutService.checkTimeouts(dto?.timeoutHours);
  }
}
