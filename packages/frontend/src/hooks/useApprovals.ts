import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as approvalService from '@/services/approvalService';
import type { GetApprovalsParams } from '@/services/approvalService';

export function useApprovals(params?: GetApprovalsParams) {
  return useQuery({
    queryKey: ['approvals', params],
    queryFn: () => approvalService.getApprovals(params),
  });
}

export function useApproval(id: string | undefined) {
  return useQuery({
    queryKey: ['approval', id],
    queryFn: () => approvalService.getApproval(id!),
    enabled: !!id,
  });
}

export function useApprovalTemplates(teamId?: string) {
  return useQuery({
    queryKey: ['approval-templates', teamId],
    queryFn: () => approvalService.getApprovalTemplates(teamId),
  });
}

export function useCreateApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      templateId: string;
      formData: Record<string, unknown>;
      teamId: string;
    }) => approvalService.createApproval(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useCreateApprovalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof approvalService.createApprovalTemplate>[0]) =>
      approvalService.createApprovalTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-templates'] });
    },
  });
}

export function useProcessApprovalAction(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof approvalService.processApprovalAction>[1]) =>
      approvalService.processApprovalAction(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useApprovalTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['approval-template', id],
    queryFn: () => approvalService.getApprovalTemplateById(id!),
    enabled: !!id,
  });
}

export function useDeleteApprovalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalService.deleteApprovalTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-templates'] });
    },
  });
}
