import { get, post } from './api';
import type { IMessage, MessageType } from '@saas/shared-types';

export interface GetMessagesParams {
  cursor?: string;
  limit?: number;
}

export interface GetMessagesResponse {
  items: IMessage[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface SendMessageData {
  content: string;
  type?: MessageType;
  replyToId?: string;
  references?: Array<{
    type: 'task' | 'doc';
    resourceId: string;
    label?: string;
  }>;
}

export function getMessages(
  teamId: string,
  params?: GetMessagesParams
): Promise<GetMessagesResponse> {
  return get<GetMessagesResponse>(`/teams/${teamId}/messages`, { params });
}

export async function sendMessage(
  teamId: string,
  data: SendMessageData
): Promise<IMessage> {
  const result = await post<{ message: IMessage & { sender?: Record<string, unknown> } }>(`/teams/${teamId}/messages`, data);
  return result.message;
}

export function searchMessages(
  teamId: string,
  q: string
): Promise<{ items: IMessage[] }> {
  return get<{ items: IMessage[] }>(`/teams/${teamId}/messages/search`, {
    params: { q },
  });
}
