import { post, get } from './api';

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

export function chat(dto: LLMChatRequest): Promise<LLMChatResponse> {
  return post<LLMChatResponse>('/llm/chat', dto);
}

export function executeSkill(
  skillId: string,
  args?: Record<string, unknown>,
  teamId?: string,
): Promise<any> {
  return post<any>(`/llm/skills/${skillId}/execute`, { args, teamId });
}

export function listMcpTools(): Promise<any[]> {
  return get<any[]>('/llm/mcp/tools');
}
