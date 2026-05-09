import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface AppendAiAuditLogInput {
  userId: string;
  tenantId: string;
  teamId?: string;
  sessionId?: string;
  skillRunId?: string;
  toolCallId?: string;
  eventType: string;
  action: string;
  status: string;
  detail?: Record<string, unknown>;
}

@Injectable()
export class LlmAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendAiAuditLogInput) {
    return this.prisma.aiAuditLog.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        teamId: input.teamId ?? null,
        sessionId: input.sessionId ?? null,
        skillRunId: input.skillRunId ?? null,
        toolCallId: input.toolCallId ?? null,
        eventType: input.eventType,
        action: input.action,
        status: input.status,
        detail: (input.detail as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  summarizePayload(payload: unknown): Record<string, unknown> {
    if (payload == null) {
      return {};
    }

    if (Array.isArray(payload)) {
      return {
        type: 'array',
        count: payload.length,
      };
    }

    if (typeof payload === 'object') {
      const value = payload as Record<string, unknown>;
      return {
        type: 'object',
        keys: Object.keys(value).slice(0, 20),
      };
    }

    return {
      type: typeof payload,
      preview: String(payload).slice(0, 300),
    };
  }
}
