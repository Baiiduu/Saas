import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { MCPToolRegistry } from './mcp/mcp.tool-registry';
import { SkillRegistry } from './skills/skill.registry';
import {
  LLMChatMessage,
  LLMChatRequest,
  LLMChatResponse,
  MCPContext,
  SkillExecutionRequest,
  SkillExecutionResult,
  MCPToolExecutionRequest,
  MCPToolExecutionResult,
} from './mcp/mcp.protocol';

/**
 * Simple circuit breaker state.
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      throw err;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}

/**
 * LlmService — OpenAI API wrapper with timeout, retry, and circuit breaker.
 *
 * Provides:
 *   - chat() — send messages to LLM
 *   - executeTool() — execute an MCP tool by ID
 *   - executeSkill() — execute a skill by ID
 *   - listTools() / listSkills() — discovery
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly configService: ConfigService,
    private readonly contextBuilder: MCPContextBuilder,
    private readonly toolRegistry: MCPToolRegistry,
    private readonly skillRegistry: SkillRegistry,
  ) {
    const llmConfig = this.configService.get('llm') ?? {};
    this.apiKey = llmConfig.apiKey || '';
    this.baseUrl = llmConfig.baseUrl || 'https://api.openai.com/v1';
    this.model = llmConfig.model || 'gpt-4';
    this.maxTokens = llmConfig.maxTokens || 4096;
    this.temperature = llmConfig.temperature ?? 0.7;
    this.timeoutMs = llmConfig.timeout || 30000;
    this.maxRetries = llmConfig.maxRetries || 3;
    this.circuitBreaker = new CircuitBreaker(
      llmConfig.circuitBreakerThreshold || 5,
      llmConfig.circuitBreakerResetMs || 60000,
    );
  }

  // ── Chat ────────────────────────────────────────────────────

  /**
   * Send a chat completion request to the LLM API.
   *
   * Supports timeout and retry logic. If the API key is not configured,
   * returns a simulated response for development/testing.
   */
  async chat(dto: LLMChatRequest, context?: MCPContext): Promise<LLMChatResponse | Record<string, unknown>> {
    // Build the system message from context if provided
    const messages = [...dto.messages];
    if (context) {
      const systemMsg = this.buildSystemMessage(context);
      // Insert system message at the beginning
      messages.unshift({ role: 'system', content: systemMsg });
    }

    // If no API key configured, use simulated response
    if (!this.apiKey) {
      this.logger.warn('LLM API key not configured, returning simulated response');
      return this.simulateChat(messages, dto);
    }

    try {
      return await this.circuitBreaker.call(async () => {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
              },
              body: JSON.stringify({
                model: dto.model ?? this.model,
                messages,
                temperature: dto.temperature ?? this.temperature,
                max_tokens: dto.maxTokens ?? this.maxTokens,
                stream: dto.stream ?? false,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
              const errorBody = await response.text();
              throw new HttpException(
                `LLM API error (${response.status}): ${errorBody}`,
                response.status,
              );
            }

            const data = await response.json();
            return {
              id: data.id,
              model: data.model,
              choices: data.choices.map((c: Record<string, unknown>) => ({
                index: c.index as number,
                message: c.message as LLMChatMessage,
                finishReason: (c as any).finish_reason as string,
              })),
              usage: {
                promptTokens: (data.usage as any)?.prompt_tokens ?? 0,
                completionTokens: (data.usage as any)?.completion_tokens ?? 0,
                totalTokens: (data.usage as any)?.total_tokens ?? 0,
              },
            } as LLMChatResponse;
          } catch (err) {
            lastError = err as Error;
            if (err instanceof HttpException) {
              throw err; // Don't retry HTTP errors
            }
            this.logger.warn(
              `Chat attempt ${attempt}/${this.maxRetries} failed: ${(err as Error).message}`,
            );
            if (attempt < this.maxRetries) {
              await this.sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
            }
          }
        }

        throw lastError ?? new Error('All chat retry attempts failed');
      });
    } catch (err) {
      this.logger.error(`Chat request failed: ${(err as Error).message}`);
      throw new HttpException(
        `LLM chat failed: ${(err as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ── MCP Tools ───────────────────────────────────────────────

  /**
   * List all registered MCP tools.
   */
  listTools() {
    return this.toolRegistry.listTools();
  }

  /**
   * Execute an MCP tool by ID.
   * The controller is responsible for checking permissions before calling this.
   */
  async executeTool(request: MCPToolExecutionRequest): Promise<MCPToolExecutionResult> {
    return this.toolRegistry.execute(request);
  }

  // ── Skills ──────────────────────────────────────────────────

  /**
   * List all registered skills.
   */
  listSkills() {
    return this.skillRegistry.listSkills();
  }

  /**
   * Execute a skill by ID.
   */
  async executeSkill(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    return this.skillRegistry.execute(request);
  }

  // ── Model Router ────────────────────────────────────────────

  /**
   * Config-driven model routing.
   * Returns the provider name and model for a given route.
   */
  resolveModel(route?: string): { provider: string; model: string } {
    const routingConfig = this.configService.get<Record<string, string>>('llm.modelRouting');
    if (route && routingConfig?.[route]) {
      return { provider: 'openai', model: routingConfig[route] };
    }
    return { provider: 'openai', model: this.model };
  }

  // ── Private Helpers ─────────────────────────────────────────

  private buildSystemMessage(context: MCPContext): string {
    return [
      'You are an AI assistant for a multi-tenant enterprise collaboration platform.',
      '',
      'Current context:',
      `- Tenant: ${context.tenantName ?? context.tenantId}`,
      `- User: ${context.userDisplayName ?? context.userId} (${context.userEmail ?? 'no email'})`,
      context.teamId ? `- Team: ${context.teamName ?? context.teamId}` : '',
      context.role ? `- Role: ${context.role}` : '',
      '',
      'You can help with task management, document collaboration, approvals, and reporting.',
      'Always respect the tenant context and user permissions.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private simulateChat(
    messages: LLMChatMessage[],
    dto: LLMChatRequest,
  ): Record<string, unknown> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const promptTokens = messages.reduce((sum, m) => sum + m.content.length, 0);

    return {
      id: `sim-${Date.now()}`,
      model: dto.model ?? this.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[SIMULATED] Received your message: "${(lastUserMsg?.content ?? '').substring(0, 100)}..."\n\nThis is a simulated response because no LLM API key is configured. Set LLM_API_KEY in your environment to connect to a real LLM provider.`,
          },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens,
        completionTokens: 50,
        totalTokens: promptTokens + 50,
      },
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
