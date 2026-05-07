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
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('Comment')
@ApiBearerAuth('access-token')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a comment on a resource' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List comments for a resource (paginated)' })
  @ApiQuery({ name: 'resourceType', required: true, example: 'task', description: 'Resource type' })
  @ApiQuery({ name: 'resourceId', required: true, example: '550e8400-e29b-41d4-a716-446655440000', description: 'Resource ID' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Paginated comments returned' })
  async findByResource(
    @Query('resourceType') resourceType: string,
    @Query('resourceId') resourceId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commentService.findByResource(
      resourceType,
      resourceId,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }

  @Patch(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own comment content (sets isEdited flag)' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 403, description: 'Not the comment owner' })
  async update(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(commentId, user.sub, dto);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a comment (owner or team admin)' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async delete(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.commentService.delete(commentId, user.sub);
  }

  @Get('attachment-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get attachment preview signed URLs' })
  @ApiQuery({ name: 'fileIds', required: true, description: 'Comma-separated file IDs' })
  @ApiResponse({ status: 200, description: 'Preview URLs returned' })
  async getAttachmentPreviewUrls(
    @Query('fileIds') fileIds: string,
  ) {
    const ids = fileIds.split(',').map((id) => id.trim()).filter(Boolean);
    return this.commentService.getAttachmentPreviewUrls(ids);
  }
}
