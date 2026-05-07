import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  createdAt: Date;
  updatedAt: Date;
  rank: number;
}

@Injectable()
export class DocumentSearchService {
  private readonly logger = new Logger(DocumentSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  async search(teamId: string, query: string, limit = 20): Promise<SearchResult[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const tsQuery = query.trim();

    // Use plainto_tsquery – safe against malformed tsquery input because it
    // treats the string as plain text and tokenises it automatically.
    const results = await this.prisma.$queryRaw<SearchResult[]>`
      SELECT
        id,
        name,
        type::text,
        content,
        file_url AS "fileUrl",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        parent_id AS "parentId",
        team_id AS "teamId",
        creator_id AS "creatorId",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        ts_rank(
          to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(content, '')),
          plainto_tsquery('simple', ${tsQuery})
        ) AS rank
      FROM tenant.documents
      WHERE
        team_id = ${teamId}::uuid
        AND deleted_at IS NULL
        AND (
          to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(content, ''))
          @@ plainto_tsquery('simple', ${tsQuery})
        )
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    this.logger.log(
      `FTS search: query="${tsQuery}" teamId=${teamId} -> ${results.length} results`,
    );
    return results;
  }
}
