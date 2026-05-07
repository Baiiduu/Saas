import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Minimal uploaded file shape (avoids requiring @types/multer).
 */
interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Recursive document tree node returned by getTree(). */
export interface DocumentTreeNode {
  id: string;
  name: string;
  type: 'FILE' | 'FOLDER';
  content?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  parentId?: string | null;
  teamId: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  creator: { id: string; displayName: string; avatar: string | null } | null;
  _count: { children: number };
  children?: DocumentTreeNode[];
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Create a folder in the document tree.
   */
  async createFolder(userId: string, dto: CreateDocumentDto) {
    // Ensure parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.document.findUnique({
        where: { id: dto.parentId },
        select: { id: true, type: true, deletedAt: true },
      });

      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Parent folder not found');
      }

      if (parent.type !== 'FOLDER') {
        throw new BadRequestException('Parent must be a folder');
      }
    }

    const folder = await this.prisma.document.create({
      data: {
        name: dto.name,
        type: 'FOLDER',
        parentId: dto.parentId ?? null,
        teamId: dto.teamId,
        creatorId: userId,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    this.logger.log(`Folder "${folder.name}" (${folder.id}) created by user ${userId}`);
    return folder;
  }

  /**
   * Upload a file, persist it via StorageService, and create a Document record.
   */
  async uploadFile(
    userId: string,
    file: UploadedFile,
    dto: CreateDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.document.findUnique({
        where: { id: dto.parentId },
        select: { id: true, type: true, deletedAt: true },
      });

      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Parent folder not found');
      }

      if (parent.type !== 'FOLDER') {
        throw new BadRequestException('Parent must be a folder');
      }
    }

    // Upload file to storage
    const storageResult = await this.storage.upload({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        type: 'FILE',
        fileUrl: storageResult.url,
        fileSize: storageResult.size,
        mimeType: storageResult.mimetype,
        parentId: dto.parentId ?? null,
        teamId: dto.teamId,
        creatorId: userId,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    // Create the first version record
    await this.prisma.docVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        fileUrl: storageResult.url,
        fileSize: storageResult.size,
        mimeType: storageResult.mimetype,
      },
    });

    this.logger.log(
      `File "${document.name}" (${document.id}) uploaded by user ${userId} (${storageResult.filename})`,
    );

    // Read text content for text files
    if (this.isTextFile(storageResult.mimetype, file.originalname)) {
      const textContent = file.buffer.toString('utf-8');
      await this.prisma.document.update({
        where: { id: document.id },
        data: { content: textContent },
      });
      // Re-fetch with creator
      const updatedDoc = await this.prisma.document.findUnique({
        where: { id: document.id },
        include: {
          creator: {
            select: { id: true, displayName: true, avatar: true },
          },
        },
      });
      this.logger.log(`Text content saved for "${document.name}" (${document.id})`);
      return updatedDoc!;
    }

    return document;
  }

  /**
   * Get the document/folder tree for a team.
   * Returns top-level items (parentId = null) with nested children.
   */
  async getTree(teamId: string, parentId?: string | null): Promise<DocumentTreeNode[]> {
    const where: Record<string, unknown> = {
      teamId,
      deletedAt: null,
    };

    if (parentId !== undefined) {
      where.parentId = parentId || null;
    } else {
      where.parentId = null;
    }

    const items = await this.prisma.document.findMany({
      where,
      orderBy: [
        { type: 'asc' }, // folders first
        { name: 'asc' },
      ],
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
        _count: {
          select: { children: true },
        },
      },
    });

    // If listing the root, also include nested children for folders
    if (!parentId) {
      const enriched: DocumentTreeNode[] = await Promise.all(
        items.map(async (item) => {
          if (item.type === 'FOLDER') {
            const children = await this.getTree(teamId, item.id);
            return { ...item, children };
          }
          return item as DocumentTreeNode;
        }),
      );
      return enriched;
    }

    // For a specific folder, return flat list of children
    return items.map((item) => ({
      ...item,
      children: undefined,
    })) as DocumentTreeNode[];
  }

  /**
   * Find a document by ID.
   */
  async findById(docId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    return doc;
  }

  /**
   * Update document metadata (name, parentId).
   */
  async update(docId: string, userId: string, data: { name?: string; parentId?: string | null }) {
    const doc = await this.findOwnedDocument(docId, userId);

    // If changing parent, validate parent exists and is a folder
    if (data.parentId !== undefined && data.parentId !== null) {
      const parent = await this.prisma.document.findUnique({
        where: { id: data.parentId },
        select: { id: true, type: true, deletedAt: true },
      });

      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Target parent folder not found');
      }

      if (parent.type !== 'FOLDER') {
        throw new BadRequestException('Target parent must be a folder');
      }
    }

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    this.logger.log(`Document ${docId} updated by user ${userId}`);
    return updated;
  }

  /**
   * Soft-delete a document. Only the creator can delete.
   */
  async delete(docId: string, userId: string) {
    const doc = await this.findOwnedDocument(docId, userId);

    // If deleting a folder, also soft-delete all nested children recursively
    if (doc.type === 'FOLDER') {
      await this.softDeleteTree(docId);
    }

    await this.prisma.document.update({
      where: { id: docId },
      data: { deletedAt: new Date() },
    });

    // Also delete the stored file if it's a FILE type
    if (doc.type === 'FILE' && doc.fileUrl) {
      const filename = doc.fileUrl.split('/').pop();
      if (filename) {
        try {
          await this.storage.delete(filename);
        } catch (err) {
          this.logger.warn(`Failed to delete storage file "${filename}": ${(err as Error).message}`);
        }
      }
    }

    this.logger.log(`Document ${docId} deleted by user ${userId}`);
  }

  /**
   * Generate a share link for a document.
   */
  async createShare(docId: string, userId: string, dto: ShareDocumentDto) {
    // Verify document exists and user is the owner
    const doc = await this.findOwnedDocument(docId, userId);

    const shareToken = crypto.randomUUID();

    const share = await this.prisma.docShare.create({
      data: {
        documentId: docId,
        shareToken,
        permission: dto.permission,
        accessCode: dto.accessCode ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: userId,
      },
      include: {
        document: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    this.logger.log(
      `Share link created for document ${docId} by user ${userId} (token: ${shareToken})`,
    );

    const baseUrl = process.env.FRONTEND_URL || '';
    return {
      ...share,
      url: `${baseUrl}/share/${shareToken}`,
    };
  }

  /**
   * Access a document via a share token.
   * Validates access_code and checks expiry.
   */
  async getShareInfo(shareToken: string, accessCode?: string) {
    const share = await this.prisma.docShare.findUnique({
      where: { shareToken },
      include: {
        document: {
          include: {
            creator: {
              select: { id: true, displayName: true, avatar: true },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    // Check expiry
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new BadRequestException('Share link has expired');
    }

    // Validate access code
    if (share.accessCode) {
      if (!accessCode) {
        throw new BadRequestException('Access code is required');
      }
      if (share.accessCode !== accessCode) {
        throw new BadRequestException('Invalid access code');
      }
    }

    return {
      document: share.document,
      permission: share.permission,
      expiresAt: share.expiresAt,
    };
  }

  /**
   * Save rich-text content (HTML/Markdown) for a document.
   * Only the document creator can save content.
   */
  async saveContent(docId: string, userId: string, content: string) {
    // Verify ownership (throws if not found, deleted, or wrong owner)
    await this.findOwnedDocument(docId, userId);

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: { content },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    this.logger.log(`Content saved for document ${docId} by user ${userId}`);
    return updated;
  }

  /**
   * Get a document's content (for the rich-text editor).
   */
  async getContent(docId: string) {
    const doc = await this.findById(docId);
    
    // If content is empty but file is a text type, try to read from stored file
    if (!doc.content && doc.fileUrl && doc.mimeType && doc.mimeType.startsWith('text/')) {
      const filename = doc.fileUrl.split('/').pop();
      if (filename) {
        try {
          const filePath = this.storage.getLocalFilePath(filename);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return {
              id: doc.id,
              name: doc.name,
              content,
              mimeType: doc.mimeType,
              fileUrl: doc.fileUrl,
              updatedAt: doc.updatedAt,
            };
          }
        } catch (err) {
          this.logger.warn(`Failed to read file for content: ${(err as Error).message}`);
        }
      }
    }
    
    return {
      id: doc.id,
      name: doc.name,
      content: doc.content,
      mimeType: doc.mimeType,
      fileUrl: doc.fileUrl,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Get document preview information.
   *
   * Determines the rendering strategy based on mimeType:
   *   - image/*  → display directly
   *   - application/pdf → embed via <iframe>/<embed>
   *   - Office docs → embed via viewer library / Office Online
   *   - text/* → render as plain text
   *   - other → unknown fallback
   */
  async preview(docId: string) {
    const doc = await this.findById(docId);

    if (doc.type === 'FOLDER') {
      throw new BadRequestException('Cannot preview a folder');
    }

    const previewType = this.determinePreviewType(doc.mimeType);

    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      mimeType: doc.mimeType,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      previewType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private determinePreviewType(mimeType: string | null): string {
    if (!mimeType) return 'unknown';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';

    // Office documents
    const officeMimes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (officeMimes.includes(mimeType)) return 'office';

    if (mimeType.startsWith('text/')) return 'text';

    return 'unknown';
  }

  // ── Version Management ────────────────────────────────────

  /**
   * List all versions for a document.
   */
  async listVersions(docId: string) {
    const doc = await this.findById(docId);
    return this.prisma.docVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Get a specific version by ID.
   */
  async getVersion(docId: string, versionId: string) {
    const doc = await this.findById(docId);
    const version = await this.prisma.docVersion.findFirst({
      where: { id: versionId, documentId: doc.id },
    });
    if (!version) {
      throw new NotFoundException('Document version not found');
    }
    return version;
  }

  /**
   * Create a new version snapshot of the current document content.
   */
  async createVersion(docId: string, userId: string, dto?: CreateVersionDto) {
    const doc = await this.findOwnedDocument(docId, userId);

    // Find the latest version number
    const latest = await this.prisma.docVersion.findFirst({
      where: { documentId: docId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const version = await this.prisma.docVersion.create({
      data: {
        documentId: docId,
        versionNumber: newVersionNumber,
        fileUrl: doc.fileUrl ?? '',
        fileSize: doc.fileSize ?? 0,
        mimeType: doc.mimeType,
      },
    });

    this.logger.log(
      `Version ${newVersionNumber} created for document ${docId} by user ${userId}`,
    );
    return version;
  }

  /**
   * Rollback a document to a specific version.
   * Restores the fileUrl and fileSize from the target version.
   */
  async rollbackToVersion(docId: string, versionId: string, userId: string) {
    await this.findOwnedDocument(docId, userId);

    const version = await this.prisma.docVersion.findFirst({
      where: { id: versionId, documentId: docId },
    });

    if (!version) {
      throw new NotFoundException('Document version not found');
    }

    // Create a new version from the current state before rollback
    const currentDoc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { fileUrl: true, fileSize: true, mimeType: true, content: true },
    });

    const latestVersion = await this.prisma.docVersion.findFirst({
      where: { documentId: docId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    // Snapshot current state as a new version
    await this.prisma.docVersion.create({
      data: {
        documentId: docId,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        fileUrl: currentDoc?.fileUrl ?? '',
        fileSize: currentDoc?.fileSize ?? 0,
        mimeType: currentDoc?.mimeType,
      },
    });

    // Restore the document to the target version
    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        fileUrl: version.fileUrl,
        fileSize: version.fileSize,
        mimeType: version.mimeType,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    this.logger.log(
      `Document ${docId} rolled back to version ${version.versionNumber} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Delete a specific version.
   */
  async deleteVersion(docId: string, versionId: string, userId: string) {
    await this.findOwnedDocument(docId, userId);

    const version = await this.prisma.docVersion.findFirst({
      where: { id: versionId, documentId: docId },
    });

    if (!version) {
      throw new NotFoundException('Document version not found');
    }

    // Don't allow deleting the last version
    const count = await this.prisma.docVersion.count({
      where: { documentId: docId },
    });

    if (count <= 1) {
      throw new BadRequestException('Cannot delete the only remaining version');
    }

    await this.prisma.docVersion.delete({
      where: { id: versionId },
    });

    this.logger.log(
      `Version ${version.versionNumber} deleted from document ${docId} by user ${userId}`,
    );
  }

  /**
   * Resolve the file path and metadata for binary file serving.
   * Used by the GET :docId/file endpoint.
   */
  async getFile(docId: string) {
    const doc = await this.findById(docId);

    if (doc.type === 'FOLDER') {
      throw new BadRequestException('Cannot get file for a folder');
    }

    if (!doc.fileUrl) {
      throw new NotFoundException('File not found');
    }

    const filename = doc.fileUrl.split('/').pop();
    if (!filename) {
      throw new NotFoundException('File not found');
    }

    const filePath = this.storage.getLocalFilePath(filename);
    return { filePath, mimeType: doc.mimeType, name: doc.name };
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Find a document and verify the requesting user is its creator.
   */
  private async findOwnedDocument(docId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: {
        id: true,
        type: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        creatorId: true,
        deletedAt: true,
      },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    if (doc.creatorId !== userId) {
      throw new ForbiddenException('You can only modify your own documents');
    }

    return doc;
  }

  /**
   * Determine if a file is a text type based on MIME type and extension.
   */
  private isTextFile(mimeType: string, fileName: string): boolean {
    if (mimeType.startsWith('text/')) return true;
    const ext = path.extname(fileName).toLowerCase();
    return ['.md', '.markdown', '.txt', '.json', '.csv'].includes(ext);
  }

  /**
   * Recursively soft-delete all children of a folder.
   */
  private async softDeleteTree(folderId: string) {
    const children = await this.prisma.document.findMany({
      where: { parentId: folderId, deletedAt: null },
      select: { id: true, type: true, fileUrl: true },
    });

    for (const child of children) {
      if (child.type === 'FOLDER') {
        await this.softDeleteTree(child.id);
      }

      await this.prisma.document.update({
        where: { id: child.id },
        data: { deletedAt: new Date() },
      });

      // Delete associated file if applicable
      if (child.type === 'FILE' && child.fileUrl) {
        const filename = child.fileUrl.split('/').pop();
        if (filename) {
          try {
            await this.storage.delete(filename);
          } catch (err) {
            this.logger.warn(
              `Failed to delete storage file "${filename}": ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }
}
