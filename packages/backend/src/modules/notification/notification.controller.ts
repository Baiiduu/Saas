import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
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
import { TenantOptional } from '../../common/decorators/tenant-optional.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationType } from '@prisma/client';

@ApiTags('Notification')
@ApiBearerAuth('access-token')
@TenantOptional()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by notification type' })
  @ApiQuery({ name: 'isRead', required: false, description: 'Filter by read status' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Paginated notifications returned' })
  async findByUser(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.findByUser(userId, query);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Not the notification owner' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationService.markRead(id, userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for the current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllRead(
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationService.markAllRead(userId);
  }

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification and optionally send an email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['TASK_ASSIGNED', 'COMMENT_MENTION', 'APPROVAL_NEEDED', 'APPROVAL_RESULT', 'DOCUMENT_SHARED', 'MEMBER_JOINED', 'TEAM_INVITE', 'MILESTONE_DUE'] },
        title: { type: 'string' },
        content: { type: 'string' },
        resourceType: { type: 'string' },
        resourceId: { type: 'string' },
        userId: { type: 'string', description: 'Target user ID' },
        sendEmail: { type: 'boolean', description: 'Also send via email (simulated)' },
      },
      required: ['type', 'title', 'userId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Notification created (and email sent if requested)' })
  async createAndSend(
    @Body() body: {
      type: NotificationType;
      title: string;
      content?: string;
      resourceType?: string;
      resourceId?: string;
      userId: string;
      sendEmail?: boolean;
    },
  ) {
    return this.notificationService.createAndSend(body);
  }
}
