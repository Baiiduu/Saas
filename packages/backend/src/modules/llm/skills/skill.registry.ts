import { Injectable, Logger } from '@nestjs/common';
import { MCPToolRegistry } from '../mcp/mcp.tool-registry';
import {
  SkillDefinition,
  SkillExecutionRequest,
  SkillExecutionResult,
} from '../mcp/mcp.protocol';

/**
 * Abstract base class for skills.
 * Each skill defines its metadata and an `execute` method.
 */
export abstract class BaseSkill {
  abstract readonly definition: SkillDefinition;
  abstract execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult>;
}

/**
 * Skill Registry — manages skill definitions and execution.
 *
 * Skills combine multiple MCP tools into higher-level automated tasks.
 * The registry supports registration, lookup, and orchestrated execution.
 */
@Injectable()
export class SkillRegistry {
  private readonly logger = new Logger(SkillRegistry.name);

  /** In-memory registry of skill definitions */
  private readonly definitions = new Map<string, SkillDefinition>();

  /** In-memory registry of skill handler instances */
  private readonly handlers = new Map<string, BaseSkill>();

  constructor(private readonly toolRegistry: MCPToolRegistry) {}

  /**
   * Register a skill.
   */
  registerSkill(skill: BaseSkill): void {
    const id = skill.definition.id;
    if (this.definitions.has(id)) {
      this.logger.warn(`Skill "${id}" is being re-registered`);
    }
    this.definitions.set(id, skill.definition);
    this.handlers.set(id, skill);
    this.logger.log(`Skill registered: "${id}" (perm: ${skill.definition.requiredPermission})`);
  }

  /**
   * Look up a skill definition by ID.
   */
  getSkill(id: string): SkillDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * List all registered skills.
   */
  listSkills(): SkillDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Execute a skill by ID.
   * The skill orchestrator walks the tool chain and collects results.
   */
  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const skill = this.handlers.get(request.skillId);
    if (!skill) {
      return {
        skillId: request.skillId,
        success: false,
        error: `Skill "${request.skillId}" not found`,
        status: 'failed',
        steps: [],
      };
    }

    this.logger.log(
      `Executing skill "${request.skillId}" for user ${request.userId}`,
    );

    try {
      return await skill.execute(request, this.toolRegistry);
    } catch (err) {
      this.logger.error(
        `Skill "${request.skillId}" execution failed: ${(err as Error).message}`,
      );
      return {
        skillId: request.skillId,
        success: false,
        error: (err as Error).message,
        status: 'failed',
        steps: [],
      };
    }
  }
}
