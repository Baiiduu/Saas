import { get, post, patch, del } from './api';
import type { IApproval, ApprovalStatus } from '@saas/shared-types';
import type { PaginatedResponse } from '@/types';

export interface GetApprovalsParams {
  status?: ApprovalStatus;
  creatorId?: string;
  page?: number;
  limit?: number;
}

export function getApprovals(
  params?: GetApprovalsParams
): Promise<PaginatedResponse<IApproval>> {
  return get<PaginatedResponse<IApproval>>('/approvals', { params });
}

export function getApproval(id: string): Promise<IApproval> {
  return get<IApproval>(`/approvals/${id}`);
}

export function createApproval(data: {
  title: string;
  templateId: string;
  formData: Record<string, unknown>;
  teamId: string;
}): Promise<IApproval> {
  return post<IApproval>('/approvals', data);
}

export function getApprovalTemplates(
  teamId?: string
): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
    formFields: Record<string, unknown>;
  }>
> {
  return get<
    Array<{
      id: string;
      name: string;
      description: string;
      formFields: Record<string, unknown>;
    }>
  >('/approval-templates', { params: { ...(teamId ? { teamId } : {}) } });
}

export function createApprovalTemplate(data: {
  name: string;
  description?: string;
  scope: string;
  formFields: Record<string, unknown>;
  teamId: string;
  nodes: Array<{
    name: string;
    approverType: string;
    sortOrder: number;
    config?: Record<string, unknown>;
  }>;
}): Promise<unknown> {
  return post<unknown>('/approval-templates', data);
}

export function getApprovalTemplateById(id: string): Promise<unknown> {
  return get<unknown>(`/approval-templates/${id}`);
}

export function updateApprovalTemplate(
  id: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return patch<unknown>(`/approval-templates/${id}`, data);
}

export function deleteApprovalTemplate(id: string): Promise<void> {
  return del<void>(`/approval-templates/${id}`);
}
