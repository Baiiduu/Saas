import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Minimal shape of an uploaded file (avoids dependency on @types/multer).
 */
interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Allowed MIME types for file uploads.
 */
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    this.isProduction = process.env.NODE_ENV === 'production';

    // Ensure upload directory exists in dev mode
    if (!this.isProduction) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Local upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Upload a file to storage.
   * - Dev: saves to local ./uploads/ directory
   * - Production: saves to MinIO bucket (stub — requires minio-js client)
   */
  async upload(file: UploadedFile) {
    // Validate file type
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. ` +
        `Allowed types: images, PDFs, documents, and text files.`,
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of 50 MB.`,
      );
    }

    // Generate a unique filename to prevent collisions
    const ext = path.extname(file.originalname) || '.bin';
    const uniqueName = `${crypto.randomUUID()}${ext}`;

    if (this.isProduction) {
      // ── Production: MinIO upload (stub) ──────────────────────
      // const { endpoint, port, accessKey, secretKey, bucket, useSSL } =
      //   this.configService.get('storage');
      //
      // const minioClient = new Minio.Client({
      //   endPoint: endpoint,
      //   port,
      //   accessKey,
      //   secretKey,
      //   useSSL,
      // });
      //
      // await minioClient.putObject(bucket, uniqueName, file.buffer, file.size, {
      //   'Content-Type': file.mimetype,
      // });
      //
      // const url = `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${bucket}/${uniqueName}`;

      this.logger.log(`[MinIO Stub] Would upload "${file.originalname}" as ${uniqueName}`);
      const url = `/api/v1/storage/${uniqueName}`;
      return { filename: uniqueName, url, mimetype: file.mimetype, size: file.size };
    }

    // ── Dev: local file storage ────────────────────────────────
    const filePath = path.join(this.uploadDir, uniqueName);
    fs.writeFileSync(filePath, file.buffer);

    this.logger.log(`File saved locally: ${filePath}`);
    return {
      filename: uniqueName,
      url: `/api/v1/storage/${uniqueName}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Resolve a filename to an absolute path within the upload directory,
   * guarding against path traversal attacks.
   */
  private resolveFilePath(filename: string): string {
    const resolvedPath = path.resolve(this.uploadDir, filename);
    const normalizedDir = path.resolve(this.uploadDir);

    if (!resolvedPath.startsWith(normalizedDir + path.sep)) {
      throw new NotFoundException(`File "${filename}" not found`);
    }

    return resolvedPath;
  }

  /**
   * Get an accessible URL or local file path for a stored file.
   */
  async getDownloadUrl(filename: string): Promise<string> {
    if (this.isProduction) {
      // In production, return a signed MinIO URL (stub)
      // const { endpoint, port, bucket, useSSL } = this.configService.get('storage');
      // const url = `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${bucket}/${filename}`;
      // return url;

      return `/api/v1/storage/${filename}`;
    }

    // In dev, return the local file path for streaming
    const filePath = this.resolveFilePath(filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File "${filename}" not found`);
    }

    return filePath;
  }

  /**
   * Get the local filesystem path for a file (dev mode only).
   */
  getLocalFilePath(filename: string): string {
    return this.resolveFilePath(filename);
  }

  /**
   * Delete a file from storage.
   */
  async delete(filename: string): Promise<void> {
    if (this.isProduction) {
      // ── Production: delete from MinIO (stub) ─────────────────
      // const minioClient = new Minio.Client({ ... });
      // await minioClient.removeObject(bucket, filename);

      this.logger.log(`[MinIO Stub] Would delete "${filename}"`);
      return;
    }

    // ── Dev: delete local file ─────────────────────────────────
    const filePath = this.resolveFilePath(filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File "${filename}" not found`);
    }

    fs.unlinkSync(filePath);
    this.logger.log(`File deleted: ${filePath}`);
  }
}
