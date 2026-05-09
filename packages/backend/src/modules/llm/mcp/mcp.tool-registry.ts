import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MCPExecutionStatus,
  MCPToolDefinition,
  MCPToolExecutionRequest,
  MCPToolExecutionResult,
} from './mcp.protocol';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmAuthorizationService } from '../llm.authorization.service';
import { LlmAuditService } from '../llm.audit.service';

/**
 * Simple tool execution handler type.
 * Each registered tool maps to an async function that receives
 * the execution request and returns a result.
 */
type ToolHandler = (
  request: MCPToolExecutionRequest,
) => Promise<MCPToolExecutionResult>;

/**
 * MCP Tool Registry — register, lookup, and execute tools.
 *
 * Each tool carries a `requiredPermission` field. Before execution,
 * callers should verify the current user's permissions via RbacGuard
 * or RbacService.
 */
@Injectable()
export class MCPToolRegistry {
  private readonly logger = new Logger(MCPToolRegistry.name);

  /** In-memory registry of tool definitions */
  private readonly definitions = new Map<string, MCPToolDefinition>();

  /** In-memory registry of tool execution handlers */
  private readonly handlers = new Map<string, ToolHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: LlmAuthorizationService,
    private readonly auditService: LlmAuditService,
  ) {}

  /**
   * Register a tool definition and its handler.
   */
  registerTool(
    definition: MCPToolDefinition,
    handler: ToolHandler,
  ): void {
    if (this.definitions.has(definition.id)) {
      this.logger.warn(`Tool "${definition.id}" is being re-registered`);
    }
    this.definitions.set(definition.id, definition);
    this.handlers.set(definition.id, handler);
    this.logger.log(`MCP tool registered: "${definition.id}" (perm: ${definition.requiredPermission})`);
  }

  /**
   * Look up a tool definition by ID.
   */
  getTool(id: string): MCPToolDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * List all registered tool definitions.
   */
  listTools(): MCPToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  async listToolsForContext(
    userId: string,
    tenantId: string,
    teamId?: string,
  ): Promise<MCPToolDefinition[]> {
    const tools = this.listTools();
    const results = await Promise.all(
      tools.map(async (tool) => ({
        tool,
        allowed: await this.authorizationService.canAccessToolDefinition(
          tool,
          userId,
          tenantId,
          teamId,
        ),
      })),
    );

    return results.filter((item) => item.allowed).map((item) => item.tool);
  }

  /**
   * Check if a tool requires a specific permission.
   */
  getRequiredPermission(toolId: string): string | undefined {
    return this.definitions.get(toolId)?.requiredPermission;
  }

  /**
   * Execute a tool by ID.
   */
  async execute(request: MCPToolExecutionRequest): Promise<MCPToolExecutionResult> {
    const start = Date.now();
    const definition = this.definitions.get(request.toolId);
    const handler = this.handlers.get(request.toolId);

    if (!handler || !definition) {
      return {
        success: false,
        error: `Tool "${request.toolId}" not found`,
        executionTimeMs: Date.now() - start,
        status: 'failed',
      };
    }

    const authorization = await this.authorizationService.authorizeToolExecution(
      definition,
      request,
    );

    if (!authorization.allowed) {
      const deniedCall =
        request.toolCallId
          ? await this.prisma.aiToolCall.update({
              where: { id: request.toolCallId },
              data: {
                status: 'FAILED',
                error: authorization.reason ?? 'Permission denied',
                executionTimeMs: Date.now() - start,
                confirmationToken: null,
              },
            })
          : await this.persistToolCall({
              request,
              definition,
              status: 'FAILED',
              error: authorization.reason ?? 'Permission denied',
              executionTimeMs: Date.now() - start,
            });

      await this.auditService.append({
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: authorization.teamId ?? request.teamId,
        sessionId: request.sessionId,
        skillRunId: request.skillRunId,
        toolCallId: deniedCall.id,
        eventType: 'permission.denied',
        action: request.toolId,
        status: 'denied',
        detail: {
          reason: authorization.reason ?? 'Permission denied',
          args: request.args,
        },
      });

      return {
        success: false,
        error: authorization.reason ?? 'Permission denied',
        executionTimeMs: Date.now() - start,
        toolCallId: deniedCall.id,
        status: 'failed',
        riskLevel: definition.riskLevel,
      };
    }

    if (definition.confirmationRequired && !request.confirmed) {
      const confirmationToken = randomUUID();
      const pendingCall = await this.persistToolCall({
        request,
        definition,
        teamId: authorization.teamId,
        status: 'WAITING_CONFIRMATION',
        confirmationToken,
        confirmationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await this.auditService.append({
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: authorization.teamId ?? request.teamId,
        sessionId: request.sessionId,
        skillRunId: request.skillRunId,
        toolCallId: pendingCall.id,
        eventType: 'confirmation.requested',
        action: request.toolId,
        status: 'pending_confirmation',
        detail: {
          args: request.args,
          confirmationToken,
        },
      });

      return {
        success: false,
        executionTimeMs: Date.now() - start,
        toolCallId: pendingCall.id,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken,
        riskLevel: definition.riskLevel,
      };
    }

    const toolCall =
      request.toolCallId
        ? await this.prisma.aiToolCall.update({
            where: { id: request.toolCallId },
            data: {
              status: 'RUNNING',
              confirmationToken: null,
            },
          })
        : await this.persistToolCall({
            request,
            definition,
            teamId: authorization.teamId,
            status: 'RUNNING',
          });

    try {
      this.logger.debug(`Executing tool "${request.toolId}" for user ${request.userId}`);
      const result = await handler(request);
      const executionTimeMs = Date.now() - start;
      const status: MCPExecutionStatus = result.success ? 'completed' : 'failed';

      await this.prisma.aiToolCall.update({
        where: { id: toolCall.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result.data as any,
          error: result.error ?? null,
          executionTimeMs,
          confirmedAt: request.confirmed ? new Date() : undefined,
        },
      });

      await this.auditService.append({
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: authorization.teamId ?? request.teamId,
        sessionId: request.sessionId,
        skillRunId: request.skillRunId,
        toolCallId: toolCall.id,
        eventType: 'tool.call',
        action: request.toolId,
        status,
        detail: {
          args: request.args,
          result: this.auditService.summarizePayload(result.data),
        },
      });

      return {
        ...result,
        executionTimeMs,
        toolCallId: toolCall.id,
        status,
        riskLevel: definition.riskLevel,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - start;
      this.logger.error(
        `Tool "${request.toolId}" execution failed: ${(err as Error).message}`,
      );

      await this.prisma.aiToolCall.update({
        where: { id: toolCall.id },
        data: {
          status: 'FAILED',
          error: (err as Error).message,
          executionTimeMs,
          confirmedAt: request.confirmed ? new Date() : undefined,
        },
      });

      await this.auditService.append({
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: authorization.teamId ?? request.teamId,
        sessionId: request.sessionId,
        skillRunId: request.skillRunId,
        toolCallId: toolCall.id,
        eventType: 'tool.call',
        action: request.toolId,
        status: 'failed',
        detail: {
          args: request.args,
          error: (err as Error).message,
        },
      });

      return {
        success: false,
        error: (err as Error).message,
        executionTimeMs,
        toolCallId: toolCall.id,
        status: 'failed',
        riskLevel: definition.riskLevel,
      };
    }
  }

  async confirm(
    toolCallId: string,
    userId: string,
    tenantId: string,
  ): Promise<MCPToolExecutionResult> {
    const pending = await this.prisma.aiToolCall.findUnique({
      where: { id: toolCallId },
    });

    if (!pending) {
      return {
        success: false,
        error: 'Pending tool call not found',
        executionTimeMs: 0,
        status: 'failed',
      };
    }

    if (pending.userId !== userId || pending.tenantId !== tenantId) {
      return {
        success: false,
        error: 'You cannot confirm this tool call',
        executionTimeMs: 0,
        toolCallId,
        status: 'failed',
      };
    }

    if (pending.status !== 'WAITING_CONFIRMATION') {
      return {
        success: false,
        error: 'Tool call is not waiting for confirmation',
        executionTimeMs: 0,
        toolCallId,
        status: 'failed',
      };
    }

    if (pending.confirmationExpiresAt && pending.confirmationExpiresAt < new Date()) {
      await this.prisma.aiToolCall.update({
        where: { id: toolCallId },
        data: {
          status: 'FAILED',
          error: 'Confirmation expired',
        },
      });

      return {
        success: false,
        error: 'Confirmation expired',
        executionTimeMs: 0,
        toolCallId,
        status: 'failed',
      };
    }

    return this.execute({
      toolId: pending.toolId,
      args: (pending.args as Record<string, unknown>) ?? {},
      userId,
      tenantId,
      teamId: pending.teamId ?? undefined,
      sessionId: pending.sessionId ?? undefined,
      skillRunId: pending.skillRunId ?? undefined,
      toolCallId: pending.id,
      confirmed: true,
    });
  }

  private async persistToolCall(params: {
    request: MCPToolExecutionRequest;
    definition: MCPToolDefinition;
    teamId?: string;
    status: 'PENDING' | 'RUNNING' | 'WAITING_CONFIRMATION' | 'COMPLETED' | 'FAILED';
    error?: string;
    confirmationToken?: string;
    confirmationExpiresAt?: Date;
    executionTimeMs?: number;
  }) {
    const { request, definition } = params;

    return this.prisma.aiToolCall.create({
      data: {
        sessionId: request.sessionId ?? null,
        skillRunId: request.skillRunId ?? null,
        userId: request.userId,
        tenantId: request.tenantId,
        teamId: params.teamId ?? request.teamId ?? null,
        toolId: definition.id,
        toolName: definition.name,
        requiredPermission: definition.requiredPermission,
        resourceType: definition.resourceType,
        actionType: definition.actionType,
        riskLevel: definition.riskLevel.toUpperCase() as any,
        status: params.status,
        args: request.args as any,
        error: params.error ?? null,
        confirmationToken: params.confirmationToken ?? null,
        confirmationExpiresAt: params.confirmationExpiresAt ?? null,
        executionTimeMs: params.executionTimeMs ?? null,
      },
    });
  }
}
