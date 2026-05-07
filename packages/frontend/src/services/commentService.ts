import { get, post, del } from './api';
import type { IComment } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

export interface GetCommentsParams {
  page?: number;
  pageSize?: number;
}

export interface CreateCommentData {
  resourceType: string;
  resourceId: string;
  content: string;
  parentId?: string;
  attachments?: string[];
}

/**
 * Fetch comments for a resource (task, document, etc.).
 */
export function getComments(
  resourceType: string,
  resourceId: string,
  params?: GetCommentsParams
): Promise<PaginatedResponse<IComment>> {
  return get<PaginatedResponse<IComment>>('/comments', {
    params: { resourceType, resourceId, ...params },
  });
}

/**
 * Create a new comment.
 */
export function createComment(data: CreateCommentData): Promise<IComment> {
  return post<IComment>('/comments', data);
}

/**
 * Delete a comment by ID.
 */
export function deleteComment(id: string): Promise<void> {
  return del<void>(`/comments/${id}`);
}
