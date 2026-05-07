import { Injectable, Logger } from '@nestjs/common';
import {
  MCPToolDefinition,
  MCPToolExecutionRequest,
  MCPToolExecutionResult,
} from './mcp.protocol';

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

  /**
   * Check if a tool requires a specific permission.
   */
  getRequiredPermission(toolId: string): string | undefined {
    return this.definitions.get(toolId)?.requiredPermission;
  }

  /**
   * Execute a tool by ID.
   *
   * ⚠ Callers must verify permissions before calling this method.
   * Permission checking is delegated to the caller (controller / guard)
   * so the registry remains a pure registration + execution layer.
   */
  async execute(request: MCPToolExecutionRequest): Promise<MCPToolExecutionResult> {
    const start = Date.now();
    const handler = this.handlers.get(request.toolId);

    if (!handler) {
      return {
        success: false,
        error: `Tool "${request.toolId}" not found`,
        executionTimeMs: Date.now() - start,
      };
    }

    try {
      this.logger.debug(`Executing tool "${request.toolId}" for user ${request.userId}`);
      const result = await handler(request);
      result.executionTimeMs = Date.now() - start;
      return result;
    } catch (err) {
      this.logger.error(
        `Tool "${request.toolId}" execution failed: ${(err as Error).message}`,
      );
      return {
        success: false,
        error: (err as Error).message,
        executionTimeMs: Date.now() - start,
      };
    }
  }
}
