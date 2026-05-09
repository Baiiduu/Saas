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

export type MCPToolActionType = 'read' | 'write';
export type MCPToolRiskLevel = 'low' | 'medium' | 'high';
export type MCPExecutionStatus =
  | 'pending'
  | 'running'
  | 'pending_confirmation'
  | 'completed'
  | 'failed';

export interface MCPToolDefinition {
  /** Unique tool identifier (e.g. "task.list", "doc.search") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description passed to the LLM for function-calling */
  description: string;
  /** JSON Schema style parameters */
  parameters: MCPToolParameter[];
  /** RBAC permission required to execute this tool (e.g. "task.read") */
  requiredPermission: string;
  /** Primary business resource touched by the tool */
  resourceType: string;
  /** Whether the tool only reads or performs writes */
  actionType: MCPToolActionType;
  /** Risk level used for confirmation and auditing */
  riskLevel: MCPToolRiskLevel;
  /** High-risk tools can require confirmation before the write is executed */
  confirmationRequired?: boolean;
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
  sessionId?: string;
  skillRunId?: string;
  toolCallId?: string;
  confirmed?: boolean;
}

export interface MCPToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  toolCallId?: string;
  status?: MCPExecutionStatus;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  riskLevel?: MCPToolRiskLevel;
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
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMChatToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMChatRequest {
  model?: string;
  messages: LLMChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: LLMChatToolDefinition[];
  toolChoice?: 'auto' | 'none';
  systemPromptSuffix?: string;
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
  sessionId?: string;
  skillRunId?: string;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  skillRunId?: string;
  status?: MCPExecutionStatus;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  steps: Array<{
    toolId: string;
    success: boolean;
    status?: MCPExecutionStatus;
    result?: unknown;
    error?: string;
    toolCallId?: string;
    requiresConfirmation?: boolean;
    confirmationToken?: string;
  }>;
}
