import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { StorageService } from './storage.service';

/**
 * Minimal uploaded-file shape used by the controller.
 * (Express.Multer.File requires @types/multer which is not installed.)
 */

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a file (max 50 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (images, PDFs, docs, text)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async upload(@UploadedFile() file: any) {
    return this.storageService.upload(file);
  }

  @Get(':filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download a file or get its URL' })
  @ApiParam({ name: 'filename', description: 'Stored filename' })
  @ApiResponse({ status: 200, description: 'File stream or URL returned' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = await this.storageService.getDownloadUrl(filename);

    // Stream the file for local dev storage
    if (fs.existsSync(filePath)) {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      // Return URL if file is remote (production stub)
      res.json({ url: filePath });
    }
  }

  @Delete(':filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file from storage' })
  @ApiParam({ name: 'filename', description: 'Stored filename' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async delete(@Param('filename') filename: string) {
    await this.storageService.delete(filename);
  }
}
