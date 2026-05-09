import { get, post } from './api';

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatRequest {
  messages: LLMChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  teamId?: string;
}

export interface LLMChatChoice {
  index: number;
  message: LLMChatMessage;
  finishReason: string;
}

export interface LLMChatResponse {
  id: string;
  model: string;
  choices: LLMChatChoice[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AiSessionSummary {
  id: string;
  title: string | null;
  teamId: string | null;
  status: string;
  lastActiveAt: string;
  createdAt: string;
  messages?: Array<{
    id: string;
    content: string;
    role: string;
    createdAt: string;
  }>;
  _count?: {
    messages: number;
  };
}

export interface AiMessage {
  id: string;
  role: 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL' | 'SKILL';
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiToolCall {
  id: string;
  toolId: string;
  toolName: string;
  status: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confirmationToken?: string | null;
  args?: Record<string, unknown>;
  createdAt: string;
}

export interface AiSessionDetail extends AiSessionSummary {
  messages: AiMessage[];
  pendingToolCalls: AiToolCall[];
}

export interface AiSkillStep {
  toolId: string;
  success: boolean;
  status?: string;
  result?: unknown;
  error?: string;
  toolCallId?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}

export interface AiSkillResult {
  skillId: string;
  skillRunId?: string;
  success: boolean;
  status?: string;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  steps: AiSkillStep[];
}

export interface AiToolDefinition {
  id: string;
  name: string;
  description: string;
  requiredPermission: string;
  resourceType: string;
  actionType: 'read' | 'write';
  riskLevel: 'low' | 'medium' | 'high';
  confirmationRequired?: boolean;
  category?: string;
}

export interface AiSkillDefinition {
  id: string;
  name: string;
  description: string;
  requiredPermission: string;
  toolChain: string[];
}

export interface CreateAiSessionRequest {
  title?: string;
  teamId?: string;
  contextResourceType?: string;
  contextResourceId?: string;
}

export interface SendAiSessionMessageRequest {
  content: string;
  teamId?: string;
  contextResourceType?: string;
  contextResourceId?: string;
  model?: string;
}

export function chat(dto: LLMChatRequest): Promise<LLMChatResponse> {
  return post<LLMChatResponse>('/llm/chat', dto);
}

export function listSessions(params?: { teamId?: string; limit?: number }): Promise<AiSessionSummary[]> {
  return get<AiSessionSummary[]>('/llm/sessions', { params });
}

export function createSession(dto?: CreateAiSessionRequest): Promise<AiSessionSummary> {
  return post<AiSessionSummary>('/llm/sessions', dto ?? {});
}

export function getSessionDetail(sessionId: string): Promise<AiSessionDetail> {
  return get<AiSessionDetail>(`/llm/sessions/${sessionId}`);
}

export function sendSessionMessage(
  sessionId: string,
  dto: SendAiSessionMessageRequest,
): Promise<{
  sessionId: string;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  response: LLMChatResponse;
}> {
  return post(`/llm/sessions/${sessionId}/messages`, dto);
}

export function listMcpTools(teamId?: string): Promise<AiToolDefinition[]> {
  return get<AiToolDefinition[]>('/llm/mcp/tools', {
    params: teamId ? { teamId } : undefined,
  });
}

export function listSkills(teamId?: string): Promise<AiSkillDefinition[]> {
  return get<AiSkillDefinition[]>('/llm/skills', {
    params: teamId ? { teamId } : undefined,
  });
}

export function executeSkill(
  skillId: string,
  args?: Record<string, unknown>,
  teamId?: string,
  sessionId?: string,
): Promise<AiSkillResult> {
  return post<AiSkillResult>(`/llm/skills/${skillId}/execute`, {
    args,
    teamId,
    sessionId,
  });
}

export function confirmToolCall(toolCallId: string) {
  return post(`/llm/tool-calls/${toolCallId}/confirm`);
}
