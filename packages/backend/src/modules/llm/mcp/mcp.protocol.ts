/**
 * MCP (Model Context Protocol) type definitions.
 *
 * These types define the contract between the LLM layer and the
 * tool/skill system. Every tool exposed via MCP carries metadata
 * including a required permission scope that can be checked against
 * the RbacGuard / RbacService at execution time.
 */

// ── Tool Definition ──────────────────────────────────────────

export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface MCPToolDefinition {
  /** Unique tool identifier (e.g. "task.list", "doc.search") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description passed to the LLM for function-calling */
  description: string;
  /** JSON Schema style parameters */
  parameters: MCPToolParameter[];
  /** RBAC permission required to execute this tool (e.g. "task:read") */
  requiredPermission: string;
  /** Optional category grouping */
  category?: string;
}

// ── Execution ─────────────────────────────────────────────────

export interface MCPToolExecutionRequest {
  toolId: string;
  args: Record<string, unknown>;
  userId: string;
  tenantId: string;
  teamId?: string;
}

export interface MCPToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
}

// ── Context ───────────────────────────────────────────────────

export interface MCPContext {
  tenantId: string;
  tenantName?: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  teamId?: string;
  teamName?: string;
  role?: string;
  /** ISO timestamp when the context was built */
  timestamp: string;
  /** Arbitrary metadata bag */
  metadata?: Record<string, unknown>;
}

// ── Chat ──────────────────────────────────────────────────────

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatRequest {
  model?: string;
  messages: LLMChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: LLMChatMessage;
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ── Skill ─────────────────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  requiredPermission: string;
  /** Ordered list of MCP tool IDs this skill chains together */
  toolChain: string[];
}

export interface SkillExecutionRequest {
  skillId: string;
  args: Record<string, unknown>;
  userId: string;
  tenantId: string;
  teamId?: string;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  steps: Array<{
    toolId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}
