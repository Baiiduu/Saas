import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuditService, AuditLogFilter } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query audit logs with filters and pagination' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action' })
  @ApiQuery({ name: 'resourceType', required: false, description: 'Filter by resource type' })
  @ApiQuery({ name: 'resourceId', required: false, description: 'Filter by resource ID' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  async query(@Query() query: AuditLogFilter) {
    return this.auditService.query(query);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export audit logs as CSV or JSON' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format (csv or json)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action' })
  @ApiQuery({ name: 'resourceType', required: false, description: 'Filter by resource type' })
  @ApiQuery({ name: 'resourceId', required: false, description: 'Filter by resource ID' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO)' })
  @ApiResponse({ status: 200, description: 'Exported audit logs' })
  async export(@Req() req: Request, @Query() filter: any) {
    return this.auditService.export(filter as AuditLogFilter);
  }
}
