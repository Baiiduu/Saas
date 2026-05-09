import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RecallMemoriesParams {
  tenantId: string;
  userId: string;
  teamId?: string;
  sessionId?: string;
  limit?: number;
}

interface RememberSessionTurnParams {
  tenantId: string;
  userId: string;
  sessionId: string;
  content: string;
  sessionTitle?: string | null;
  teamId?: string;
}

@Injectable()
export class LlmMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listRelevantMemories(params: RecallMemoriesParams) {
    const { tenantId, userId, teamId, sessionId, limit = 5 } = params;
    const candidateLimit = Math.max(limit * 4, 20);
    const currentSessionKey = sessionId
      ? teamId
        ? `team:${teamId}:session:${sessionId}:focus`
        : `session:${sessionId}:focus`
      : null;

    const candidates = await this.prisma.aiMemory.findMany({
      where: {
        tenantId,
        OR: teamId
          ? [
              { scope: 'USER', userId, teamId },
              { scope: 'USER', userId, teamId: null },
              { scope: 'TEAM', teamId },
            ]
          : [{ scope: 'USER', userId, teamId: null }],
      },
      orderBy: [{ lastReferencedAt: 'desc' }, { updatedAt: 'desc' }],
      take: candidateLimit,
      select: {
        id: true,
        scope: true,
        key: true,
        content: true,
        metadata: true,
        updatedAt: true,
      },
    });

    const preferences = candidates.filter((memory) => this.isStablePreference(memory.metadata));
    const sessionSummaries = currentSessionKey
      ? candidates.filter(
          (memory) =>
            memory.key === currentSessionKey &&
            this.isSessionSummary(memory.metadata),
        )
      : [];

    const selected = [...preferences, ...sessionSummaries]
      .filter((memory, index, list) => list.findIndex((item) => item.id === memory.id) === index)
      .slice(0, limit);

    if (selected.length > 0) {
      await this.prisma.aiMemory.updateMany({
        where: { id: { in: selected.map((memory) => memory.id) } },
        data: { lastReferencedAt: new Date() },
      });
    }

    return selected.map((memory) => ({
      scope: memory.scope,
      key: memory.key,
      content: memory.content,
      metadata: memory.metadata,
      updatedAt: memory.updatedAt.toISOString(),
    }));
  }

  async rememberSessionTurn(params: RememberSessionTurnParams) {
    const { tenantId, userId, sessionId, content, sessionTitle, teamId } = params;
    const entries = this.buildMemoryEntries({
      content,
      sessionId,
      sessionTitle,
      teamId,
    });

    if (entries.length === 0) {
      return null;
    }

    for (const entry of entries) {
      const payload = {
        tenantId,
        userId,
        teamId: teamId ?? null,
        sourceSessionId: sessionId,
        scope: 'USER' as const,
        key: entry.key,
        content: entry.content,
        metadata: entry.metadata as Prisma.InputJsonValue,
        lastReferencedAt: new Date(),
      };

      const existing = await this.prisma.aiMemory.findFirst({
        where: {
          tenantId,
          userId,
          key: entry.key,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.aiMemory.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await this.prisma.aiMemory.create({
          data: payload,
        });
      }
    }

    await this.prisma.aiMemory.deleteMany({
      where: {
        tenantId,
        userId,
        scope: 'USER',
        id: {
          notIn: (
            await this.prisma.aiMemory.findMany({
              where: {
                tenantId,
                userId,
                scope: 'USER',
              },
              orderBy: { updatedAt: 'desc' },
              take: 20,
              select: { id: true },
            })
          ).map((memory) => memory.id),
        },
      },
    });
  }

  private buildMemoryEntries(params: {
    content: string;
    sessionId: string;
    sessionTitle?: string | null;
    teamId?: string;
  }): Array<{
    key: string;
    content: string;
    metadata: Record<string, unknown>;
  }> {
    const normalized = params.content.trim().replace(/\s+/g, ' ');
    const entries: Array<{
      key: string;
      content: string;
      metadata: Record<string, unknown>;
    }> = [];

    if (!normalized) {
      return entries;
    }

    const languagePreference = this.extractLanguagePreference(normalized, params.teamId);
    if (languagePreference) {
      entries.push(languagePreference);
    }

    const outputPreference = this.extractOutputPreference(normalized, params.teamId);
    if (outputPreference) {
      entries.push(outputPreference);
    }

    const focusKey = params.teamId
      ? `team:${params.teamId}:session:${params.sessionId}:focus`
      : `session:${params.sessionId}:focus`;
    const focusSummary = (params.sessionTitle ?? normalized).slice(0, 80);
    entries.push({
      key: focusKey,
      content: `当前会话关注：${focusSummary}`,
      metadata: {
        kind: 'session_focus',
      },
    });

    return entries;
  }

  private extractLanguagePreference(
    content: string,
    teamId?: string,
  ): { key: string; content: string; metadata: Record<string, unknown> } | null {
    if (!/(默认|以后|请用|用).*?(中文|英文|english)/i.test(content)) {
      return null;
    }

    const language = /英文|english/i.test(content) ? '英文' : '中文';
    return {
      key: teamId ? `team:${teamId}:preference:language` : 'preference:language',
      content: `默认使用${language}输出`,
      metadata: {
        kind: 'stable_preference',
        preference: 'language',
      },
    };
  }

  private extractOutputPreference(
    content: string,
    teamId?: string,
  ): { key: string; content: string; metadata: Record<string, unknown> } | null {
    if (!/(偏好|默认|请用|用).*(列表|markdown|表格|简洁|详细)/i.test(content)) {
      return null;
    }

    const matched =
      content.match(/(列表|markdown|表格|简洁|详细)/i)?.[1] ??
      '结构化';

    return {
      key: teamId ? `team:${teamId}:preference:format` : 'preference:format',
      content: `默认采用${matched}输出风格`,
      metadata: {
        kind: 'stable_preference',
        preference: 'format',
      },
    };
  }

  private isStablePreference(metadata: unknown): boolean {
    return this.getMetadataKind(metadata) === 'stable_preference';
  }

  private isSessionSummary(metadata: unknown): boolean {
    const kind = this.getMetadataKind(metadata);
    return kind === 'session_focus' || kind === 'session_summary';
  }

  private getMetadataKind(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const kind = (metadata as Record<string, unknown>).kind;
    return typeof kind === 'string' ? kind : null;
  }
}
