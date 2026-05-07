import { get, patch, post } from './api';
import type { INotification, NotificationType } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

export interface GetNotificationsParams {
  type?: NotificationType;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export function getNotifications(
  params?: GetNotificationsParams
): Promise<PaginatedResponse<INotification>> {
  return get<PaginatedResponse<INotification>>('/notifications', { params });
}

export function markAsRead(id: string): Promise<void> {
  return patch<void>(`/notifications/${id}/read`);
}

export function markAllAsRead(): Promise<void> {
  return post<void>('/notifications/read-all');
}
