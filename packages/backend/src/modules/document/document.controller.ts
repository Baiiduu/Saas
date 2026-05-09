import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DocumentService } from './document.service';
import { DocumentSearchService } from './document-search.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';

@ApiTags('Document')
@ApiBearerAuth('access-token')
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentSearchService: DocumentSearchService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List documents/folders for a team' })
  @ApiQuery({ name: 'teamId', required: true, example: '550e8400-e29b-41d4-a716-446655440000', description: 'Team ID' })
  @ApiQuery({ name: 'parentId', required: false, example: '550e8400-e29b-41d4-a716-446655440000', description: 'Parent folder ID (omit for root)' })
  @ApiResponse({ status: 200, description: 'Document tree or list' })
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Query('teamId') teamId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.documentService.getTree(user.sub, tenantId, teamId, parentId ?? undefined);
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full-text search documents' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'teamId', required: true, description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Search results ranked by relevance' })
  async search(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Query() searchDto: SearchDocumentDto,
  ) {
    return this.documentSearchService.search(
      user.sub,
      tenantId,
      searchDto.teamId,
      searchDto.q,
      {
        creatorId: searchDto.creatorId,
        createdFrom: searchDto.createdFrom,
        createdTo: searchDto.createdTo,
        updatedFrom: searchDto.updatedFrom,
        updatedTo: searchDto.updatedTo,
        limit: searchDto.limit,
      },
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create folder or upload file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (omit when type=FOLDER)',
        },
        name: { type: 'string', description: 'Document or folder name' },
        type: { type: 'string', enum: ['FILE', 'FOLDER'], description: 'Document type' },
        parentId: { type: 'string', format: 'uuid', description: 'Parent folder ID' },
        teamId: { type: 'string', format: 'uuid', description: 'Team ID' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: any,
  ) {
    if (dto.type === 'FOLDER') {
      return this.documentService.createFolder(user.sub, tenantId, dto);
    }
    // file is required for FILE type - FileInterceptor provides it
    return this.documentService.uploadFile(user.sub, tenantId, file, dto);
  }

  @Get(':docId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document detail' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findById(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.findById(user.sub, tenantId, docId, shareToken, accessCode);
  }

  @Get(':docId/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document preview info' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document preview info with previewType' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async preview(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.preview(user.sub, tenantId, docId, shareToken, accessCode);
  }

  @Get(':docId/content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document content (rich-text editor)' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document content returned' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getContent(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.getContent(user.sub, tenantId, docId, shareToken, accessCode);
  }

  @Patch(':docId/content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save document content (HTML/Markdown)' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'HTML or Markdown content' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Content saved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async saveContent(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body('content') content: string,
    @Body('shareToken') shareToken?: string,
    @Body('accessCode') accessCode?: string,
  ) {
    return this.documentService.saveContent(docId, user.sub, tenantId, content, shareToken, accessCode);
  }

  @Get(':docId/file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the uploaded file for inline preview/download' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'File stream returned with correct Content-Type' })
  @ApiResponse({ status: 404, description: 'Document or file not found' })
  async getFile(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    const fileInfo = await this.documentService.getFile(user.sub, tenantId, docId, shareToken, accessCode);
    
    const { existsSync, createReadStream } = require('fs');
    
    if (!existsSync(fileInfo.filePath)) {
      throw new NotFoundException('File not found on disk');
    }
    
    res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.name || 'file')}"`);
    
    const stream = createReadStream(fileInfo.filePath);
    stream.pipe(res);
  }

  @Patch(':docId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update document (name, parentId)' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New name' },
        parentId: { type: 'string', format: 'uuid', nullable: true, description: 'Move to folder (null = root)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Document updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async update(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() data: { name?: string; parentId?: string | null },
  ) {
    return this.documentService.update(docId, user.sub, tenantId, data);
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document (owner only)' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async delete(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    await this.documentService.delete(docId, user.sub, tenantId);
  }

  @Post(':docId/share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate share link for a document' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiBody({ type: ShareDocumentDto })
  @ApiResponse({ status: 201, description: 'Share link generated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async createShare(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documentService.createShare(docId, user.sub, tenantId, dto);
  }

  @Public()
  @Get('share/:shareToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access document via share link' })
  @ApiParam({ name: 'shareToken', description: 'Share token (UUID)' })
  @ApiQuery({ name: 'accessCode', required: false, description: 'Access code if required' })
  @ApiResponse({ status: 200, description: 'Document info returned' })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  @ApiResponse({ status: 400, description: 'Expired or invalid access code' })
  async getShareInfo(
    @Param('shareToken') shareToken: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.getShareInfo(shareToken, accessCode);
  }

  // ── Version Management ────────────────────────────────────

  @Get(':docId/versions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all versions of a document' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Versions returned' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async listVersions(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.listVersions(user.sub, tenantId, docId, shareToken, accessCode);
  }

  @Get(':docId/versions/:versionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific document version' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Version detail returned' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersion(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
    @Query('shareToken') shareToken?: string,
    @Query('accessCode') accessCode?: string,
  ) {
    return this.documentService.getVersion(user.sub, tenantId, docId, versionId, shareToken, accessCode);
  }

  @Post(':docId/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new version snapshot' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiBody({ type: CreateVersionDto, required: false })
  @ApiResponse({ status: 201, description: 'Version created' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async createVersion(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto?: CreateVersionDto,
  ) {
    return this.documentService.createVersion(docId, user.sub, tenantId, dto);
  }

  @Post(':docId/versions/:versionId/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback document to a specific version' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID to rollback to' })
  @ApiResponse({ status: 200, description: 'Document rolled back' })
  @ApiResponse({ status: 404, description: 'Document or version not found' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async rollbackVersion(
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    return this.documentService.rollbackToVersion(docId, versionId, user.sub, tenantId);
  }

  @Delete(':docId/versions/:versionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific version' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 204, description: 'Version deleted' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete last version' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  async deleteVersion(
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    await this.documentService.deleteVersion(docId, versionId, user.sub, tenantId);
  }
}
