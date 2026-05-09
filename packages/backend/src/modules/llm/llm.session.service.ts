import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { LlmService } from './llm.service';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';
import { ListAiSessionsDto } from './dto/list-ai-sessions.dto';
import { SendAiMessageDto } from './dto/send-ai-message.dto';
import { LlmAuditService } from './llm.audit.service';
import { LlmAuthorizationService } from './llm.authorization.service';
import { LlmResponseComposerService } from './llm.response-composer.service';
import { LLMChatMessage, MCPToolDefinition } from './mcp/mcp.protocol';

@Injectable()
export class LlmSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextBuilder: MCPContextBuilder,
    private readonly llmService: LlmService,
    private readonly auditService: LlmAuditService,
    private readonly authorizationService: LlmAuthorizationService,
    private readonly responseComposer: LlmResponseComposerService,
  ) {}

  async createSession(
    userId: string,
    tenantId: string,
    dto: CreateAiSessionDto,
  ) {
    await this.authorizationService.assertPermission('llm.create', userId, tenantId, dto.teamId);

    const session = await this.prisma.aiSession.create({
      data: {
        tenantId,
        userId,
        teamId: dto.teamId ?? null,
        title: dto.title ?? null,
        contextResourceType: dto.contextResourceType ?? null,
        contextResourceId: dto.contextResourceId ?? null,
      },
    });

    await this.auditService.append({
      userId,
      tenantId,
      teamId: dto.teamId,
      sessionId: session.id,
      eventType: 'session.created',
      action: 'session.create',
      status: 'completed',
      detail: {
        title: dto.title ?? null,
      },
    });

    return session;
  }

  async listSessions(
    userId: string,
    tenantId: string,
    query: ListAiSessionsDto,
  ) {
    await this.authorizationService.assertPermission('llm.read', userId, tenantId, query.teamId);

    return this.prisma.aiSession.findMany({
      where: {
        tenantId,
        userId,
        teamId: query.teamId ?? undefined,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { lastActiveAt: 'desc' },
      take: query.limit,
    });
  }

  async getSessionDetail(
    sessionId: string,
    userId: string,
    tenantId: string,
  ) {
    const session = await this.getOwnedSession(sessionId, userId, tenantId);
    await this.authorizationService.assertPermission('llm.read', userId, tenantId, session.teamId ?? undefined);

    const [messages, pendingToolCalls] = await this.prisma.$transaction([
      this.prisma.aiMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiToolCall.findMany({
        where: {
          sessionId,
          status: 'WAITING_CONFIRMATION',
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      ...session,
      messages,
      pendingToolCalls,
    };
  }

  async sendMessage(
    userId: string,
    tenantId: string,
    sessionId: string,
    dto: SendAiMessageDto,
  ) {
    const session = await this.getOwnedSession(sessionId, userId, tenantId);
    const effectiveTeamId = dto.teamId ?? session.teamId ?? undefined;
    await this.authorizationService.assertPermission('llm.create', userId, tenantId, effectiveTeamId);

    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: {
        teamId: effectiveTeamId ?? null,
        contextResourceType: dto.contextResourceType ?? session.contextResourceType ?? null,
        contextResourceId: dto.contextResourceId ?? session.contextResourceId ?? null,
        title: session.title ?? this.buildSessionTitle(dto.content),
        lastActiveAt: new Date(),
      },
    });

    const userMessage = await this.prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'USER',
        content: dto.content,
        metadata: {
          contextResourceType: dto.contextResourceType ?? null,
          contextResourceId: dto.contextResourceId ?? null,
        },
      },
    });

    const recentHistory = await this.prisma.aiMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const history = [...recentHistory].reverse();

    const llmMessages = history
      .map((message) => this.toLlmMessage(message.role, message.content, message.metadata))
      .filter((message): message is LLMChatMessage => !!message);

    const context = await this.contextBuilder.buildContext({
      userId,
      tenantId,
      teamId: effectiveTeamId,
    });

    context.metadata = {
      ...(context.metadata ?? {}),
      sessionId,
      contextResourceType: dto.contextResourceType ?? session.contextResourceType ?? null,
      contextResourceId: dto.contextResourceId ?? session.contextResourceId ?? null,
      messageCount: history.length,
    };

    const availableTools = await this.llmService.listToolsForContext(
      userId,
      tenantId,
      effectiveTeamId,
    );
    const llmToolDefinitions = this.llmService.buildLlmToolDefinitions(availableTools);
    const systemPromptSuffix = this.llmService.buildToolCallingPrompt(availableTools);

    let response: unknown = null;
    let finalAssistantMessage: Awaited<ReturnType<typeof this.prisma.aiMessage.create>> | null = null;
    const steps: Array<Record<string, unknown>> = [];
    const sources: Array<Record<string, unknown>> = [];
    const workingMessages = [...llmMessages];

    try {
      for (let round = 0; round < 6; round++) {
        response = await this.llmService.chat(
          {
            messages: workingMessages,
            model: dto.model,
            tools: llmToolDefinitions,
            toolChoice: llmToolDefinitions.length > 0 ? 'auto' : 'none',
            systemPromptSuffix,
          },
          context,
        );

        const assistant = (response as any)?.choices?.[0]?.message as LLMChatMessage | undefined;
        if (!assistant) {
          throw new Error('LLM 未返回可解析消息');
        }

        const requestedToolCalls = this.extractRequestedToolCalls(assistant, availableTools).map((call) => ({
          ...call,
          args: this.normalizeToolArgs(call.toolId, call.args, availableTools, effectiveTeamId),
        }));
        if (requestedToolCalls.length === 0) {
          const assistantContent =
            assistant.content.trim() ||
            (steps.length > 0
              ? '已完成工具调用，但模型未输出最终总结。'
              : 'AI 未返回可解析内容。');

          finalAssistantMessage = await this.prisma.aiMessage.create({
            data: {
              sessionId,
              role: 'ASSISTANT',
              content: assistantContent,
              metadata: {
                model: (response as any)?.model ?? null,
                responseId: (response as any)?.id ?? null,
                usage: (response as any)?.usage ?? null,
                routeMode: steps.length > 0 ? 'model_tool_loop' : 'chat',
                classification: steps.length > 0 ? 'tool_grounded' : 'normal_chat',
                steps,
                sources,
              } as Prisma.InputJsonValue,
            },
          });

          break;
        }

        const assistantToolCallMessage = await this.prisma.aiMessage.create({
          data: {
            sessionId,
            role: 'ASSISTANT',
            content:
              assistant.content.trim() ||
              `正在调用工具：${requestedToolCalls.map((call) => call.toolId).join('、')}`,
            metadata: {
              model: (response as any)?.model ?? null,
              responseId: (response as any)?.id ?? null,
              usage: (response as any)?.usage ?? null,
              routeMode: 'model_tool_loop',
              classification: 'tool_request',
              toolCalls: requestedToolCalls.map((call) => ({
                id: call.id,
                toolId: call.toolId,
                args: call.args,
              })),
            } as Prisma.InputJsonValue,
          },
        });

        workingMessages.push(
          this.toLlmMessage(
            assistantToolCallMessage.role,
            assistantToolCallMessage.content,
            assistantToolCallMessage.metadata,
          )!,
        );

        let pendingConfirmationContent: string | null = null;

        for (const call of requestedToolCalls) {
          const result = await this.llmService.executeTool({
            toolId: call.toolId,
            args: call.args,
            userId,
            tenantId,
            teamId: effectiveTeamId,
            sessionId,
          });

          const step = {
            toolId: call.toolId,
            success: result.success,
            status: result.status ?? (result.success ? 'completed' : 'failed'),
            toolCallId: result.toolCallId ?? null,
            requiresConfirmation: result.requiresConfirmation ?? false,
            confirmationToken: result.confirmationToken ?? null,
            error: result.error ?? null,
          };
          steps.push(step);

          if (result.success) {
            this.mergeSources(
              sources,
              this.responseComposer.composeToolResponse(call.toolId, result.data).sources,
            );
          }

          const toolPayload = {
            toolId: call.toolId,
            status: step.status,
            success: result.success,
            requiresConfirmation: result.requiresConfirmation ?? false,
            confirmationToken: result.confirmationToken ?? null,
            riskLevel: result.riskLevel ?? null,
            data: result.data ?? null,
            error: result.error ?? null,
          };

          const toolMessage = await this.prisma.aiMessage.create({
            data: {
              sessionId,
              role: 'TOOL',
              content: JSON.stringify(toolPayload, null, 2),
              metadata: {
                toolId: call.toolId,
                toolCallId: result.toolCallId ?? null,
                modelToolCallId: call.id,
                status: step.status,
                success: result.success,
                args: call.args,
              } as Prisma.InputJsonValue,
            },
          });

          workingMessages.push(
            this.toLlmMessage(toolMessage.role, toolMessage.content, toolMessage.metadata)!,
          );

          if (result.status === 'pending_confirmation') {
            pendingConfirmationContent = `已生成待确认操作：${call.toolId}。确认后系统才会真正执行写入。`;
          }
        }

        if (pendingConfirmationContent) {
          finalAssistantMessage = await this.prisma.aiMessage.create({
            data: {
              sessionId,
              role: 'ASSISTANT',
              content: pendingConfirmationContent,
              metadata: {
                model: (response as any)?.model ?? null,
                responseId: (response as any)?.id ?? null,
                usage: (response as any)?.usage ?? null,
                routeMode: 'model_tool_loop',
                classification: 'pending_confirmation',
                steps,
                sources,
              } as Prisma.InputJsonValue,
            },
          });

          break;
        }
      }
    } catch (error) {
      await this.auditService.append({
        userId,
        tenantId,
        teamId: effectiveTeamId,
        sessionId,
        eventType: 'model.call',
        action: 'chat.message',
        status: 'failed',
        detail: {
          requestMessageId: userMessage.id,
          error: (error as Error).message,
        },
      });
      throw error;
    }

    if (!finalAssistantMessage) {
      finalAssistantMessage = await this.prisma.aiMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: '工具调用次数超过限制，请缩小问题范围后重试。',
          metadata: {
            model: (response as any)?.model ?? null,
            responseId: (response as any)?.id ?? null,
            usage: (response as any)?.usage ?? null,
            routeMode: 'model_tool_loop',
            classification: 'tool_loop_exhausted',
            steps,
            sources,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    await this.auditService.append({
      userId,
      tenantId,
      teamId: effectiveTeamId,
      sessionId,
      eventType: 'model.call',
      action: 'chat.message',
      status: 'completed',
      detail: {
        model: (response as any)?.model ?? null,
        requestMessageId: userMessage.id,
        responseMessageId: finalAssistantMessage.id,
        toolSteps: steps.length,
      },
    });

    return {
      sessionId,
      userMessage,
      assistantMessage: finalAssistantMessage,
      response,
    };
  }

  async appendAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    const message = await this.prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content,
        metadata: (metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    return message;
  }

  private async getOwnedSession(
    sessionId: string,
    userId: string,
    tenantId: string,
  ) {
    const session = await this.prisma.aiSession.findFirst({
      where: {
        id: sessionId,
        userId,
        tenantId,
      },
    });

    if (!session) {
      throw new NotFoundException('AI session not found');
    }

    return session;
  }

  private toLlmMessage(
    role: string,
    content: string,
    metadata?: Prisma.JsonValue | null,
  ): LLMChatMessage | null {
    if (role === 'USER') {
      return { role: 'user', content };
    }

    if (role === 'ASSISTANT' || role === 'SKILL') {
      const toolCalls = this.normalizeStoredToolCalls(metadata);
      return {
        role: 'assistant',
        content,
        toolCalls,
      };
    }

    if (role === 'TOOL') {
      const metadataRecord = this.asRecord(metadata);
      const modelToolCallId =
        typeof metadataRecord?.modelToolCallId === 'string'
          ? metadataRecord.modelToolCallId
          : null;

      if (!modelToolCallId) {
        return {
          role: 'assistant',
          content,
        };
      }

      return {
        role: 'tool',
        content,
        toolCallId: modelToolCallId,
      };
    }

    if (role === 'SYSTEM') {
      return { role: 'system', content };
    }

    return null;
  }

  private buildSessionTitle(content: string): string {
    return content.trim().replace(/\s+/g, ' ').slice(0, 40) || '新会话';
  }

  private extractRequestedToolCalls(
    assistant: LLMChatMessage,
    availableTools: MCPToolDefinition[],
  ): Array<{ id: string; toolId: string; args: Record<string, unknown> }> {
    if (Array.isArray(assistant.toolCalls) && assistant.toolCalls.length > 0) {
      return assistant.toolCalls.flatMap((call) => {
        const resolvedToolId = this.llmService.resolveToolName(
          call.function.name,
          availableTools,
        );
        if (!resolvedToolId) {
          return [];
        }

        try {
          const parsed = JSON.parse(call.function.arguments || '{}');
          return [{
            id: call.id,
            toolId: resolvedToolId,
            args: this.asRecord(parsed) ?? {},
          }];
        } catch {
          return [];
        }
      });
    }

    const directive = this.extractToolDirective(assistant.content);
    const resolvedToolId = directive
      ? this.llmService.resolveToolName(directive.tool, availableTools)
      : null;
    if (!directive || !resolvedToolId) {
      return [];
    }

    return [{
      id: `directive-${randomUUID()}`,
      toolId: resolvedToolId,
      args: directive.args,
    }];
  }

  private extractToolDirective(content: string): { tool: string; args: Record<string, unknown> } | null {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
    const candidate = fencedMatch?.[1]?.trim() || trimmed;

    try {
      const parsed = JSON.parse(candidate);
      const record = this.asRecord(parsed);
      if (!record || typeof record.tool !== 'string') {
        return null;
      }

      return {
        tool: record.tool,
        args: this.asRecord(record.args) ?? {},
      };
    } catch {
      return null;
    }
  }

  private normalizeStoredToolCalls(metadata?: Prisma.JsonValue | null) {
    const metadataRecord = this.asRecord(metadata);
    if (!Array.isArray(metadataRecord?.toolCalls)) {
      return undefined;
    }

    const toolCalls = metadataRecord.toolCalls
      .map((item) => {
        const record = this.asRecord(item);
        if (!record || typeof record.id !== 'string' || typeof record.toolId !== 'string') {
          return null;
        }

        return {
          id: record.id,
          type: 'function' as const,
          function: {
            name: this.llmService.getLlmToolName(record.toolId),
            arguments: JSON.stringify(this.asRecord(record.args) ?? {}),
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  private mergeSources(
    target: Array<Record<string, unknown>>,
    next: Array<{ type: string; id: string; title: string; subtitle?: string }>,
  ) {
    for (const source of next) {
      const exists = target.some(
        (item) =>
          item.type === source.type &&
          item.id === source.id,
      );

      if (!exists) {
        target.push({
          type: source.type,
          id: source.id,
          title: source.title,
          subtitle: source.subtitle ?? null,
        });
      }
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalizeToolArgs(
    toolId: string,
    args: Record<string, unknown>,
    availableTools: MCPToolDefinition[],
    currentTeamId?: string,
  ): Record<string, unknown> {
    const tool = availableTools.find((item) => item.id === toolId);
    if (!tool) {
      return args;
    }

    const normalized = { ...args };
    const expectsTeamId = tool.parameters.some((parameter) => parameter.name === 'teamId');
    if (!expectsTeamId || !currentTeamId) {
      return normalized;
    }

    const rawTeamId = normalized.teamId;
    if (typeof rawTeamId !== 'string' || !this.isUuid(rawTeamId)) {
      normalized.teamId = currentTeamId;
    }

    return normalized;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
