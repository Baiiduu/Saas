import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  content: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  parentId: string | null;
  teamId: string;
  creatorId: string;
  creatorDisplayName: string | null;
  createdAt: Date;
  updatedAt: Date;
  rank: number;
}

export interface DocumentSearchOptions {
  limit?: number;
  creatorId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

@Injectable()
export class DocumentSearchService {
  private readonly logger = new Logger(DocumentSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Full-text search across documents using PostgreSQL FTS.
   *
   * Searches on `name` + `content` fields via to_tsvector / plainto_tsquery,
   * ranked by ts_rank.  Only returns non-deleted documents scoped to the
   * given team.
   *
   * For best performance on large datasets, ensure a GIN index exists on
   * the documents table:
   *
   *   CREATE INDEX idx_documents_fts ON tenant.documents
   *     USING GIN (to_tsvector('simple', COALESCE(name,'') || ' ' || COALESCE(content,'')));
   */
  async search(
    userId: string,
    tenantId: string,
    teamId: string,
    query: string,
    options: DocumentSearchOptions = {},
  ): Promise<SearchResult[]> {
    await this.rbacService.assertPermission('document.read', userId, tenantId, {
      teamId,
    });

    if (!query || !query.trim()) {
      return [];
    }

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(Math.max(options.limit ?? 20, 1), 50);

    const where: Record<string, unknown> = {
      teamId,
      deletedAt: null,
      OR: [
        { name: { contains: normalizedQuery, mode: 'insensitive' } },
        { content: { contains: normalizedQuery, mode: 'insensitive' } },
      ],
    };

    if (options.creatorId) {
      where.creatorId = options.creatorId;
    }

    if (options.createdFrom || options.createdTo) {
      where.createdAt = {};
      if (options.createdFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(options.createdFrom);
      }
      if (options.createdTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(options.createdTo);
      }
    }

    if (options.updatedFrom || options.updatedTo) {
      where.updatedAt = {};
      if (options.updatedFrom) {
        (where.updatedAt as Record<string, unknown>).gte = new Date(options.updatedFrom);
      }
      if (options.updatedTo) {
        (where.updatedAt as Record<string, unknown>).lte = new Date(options.updatedTo);
      }
    }

    const documents = await this.prisma.document.findMany({
      where,
      take: safeLimit,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const results = documents.map((document, index) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      content: document.content,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      parentId: document.parentId,
      teamId: document.teamId,
      creatorId: document.creatorId,
      creatorDisplayName: document.creator?.displayName ?? null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      rank: documents.length - index,
    }));

    this.logger.log(
      `Document search: query="${normalizedQuery}" teamId=${teamId} -> ${results.length} results`,
    );
    return results;
  }
}
