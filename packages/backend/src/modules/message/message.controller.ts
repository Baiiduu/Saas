import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { MessageService, SendMessagePayload } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Message')
@ApiBearerAuth('access-token')
@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // ── REST fallback: send message via HTTP ────────────────────

  @Post('teams/:teamId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a team with @task / @doc support' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent (with optional quick-create task / doc references)' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('teamId') teamId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messageService.sendMessage(user.sub, { ...dto, teamId } as SendMessagePayload);
  }

  // ── History with cursor-based pagination ────────────────────

  @Get('teams/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get message history with cursor-based pagination' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor message ID for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Messages per page (default 50)' })
  @ApiResponse({ status: 200, description: 'Message history returned' })
  async getHistory(
    @Param('id') teamId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messageService.getHistory(
      teamId,
      cursor,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ── Search ──────────────────────────────────────────────────

  @Get('teams/:id/messages/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search messages by text content' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async search(
    @Param('id') teamId: string,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messageService.search(
      teamId,
      query,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ── Read Status ──────────────────────────────────────────────

  @Post('messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a message as read by the current user' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  async markAsRead(
    @Param('messageId') messageId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.messageService.markAsRead(messageId, userId);
    return { message: 'Message marked as read' };
  }

  @Get('messages/:messageId/read-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get read status (who has read this message)' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Read status returned' })
  async getReadStatus(@Param('messageId') messageId: string) {
    return this.messageService.getReadStatus(messageId);
  }
}
