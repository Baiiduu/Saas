import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as documentService from '@/services/documentService';

export function useDocuments(parentId?: string, teamId?: string) {
  return useQuery({
    queryKey: ['documents', parentId, teamId],
    queryFn: () => documentService.getDocuments(parentId, teamId),
  });
}

export function useDocumentTree(teamId?: string) {
  return useQuery({
    queryKey: ['documents', 'tree', teamId],
    queryFn: () => documentService.getDocumentTree(teamId),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentService.getDocument(id!),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      parentId?: string;
      teamId: string;
    }) => documentService.createFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => documentService.uploadFile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ name: string; parentId?: string | null }>;
    }) => documentService.updateDocument(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] });
    },
  });
}

export function useDocumentVersions(docId: string | undefined) {
  return useQuery({
    queryKey: ['document', docId, 'versions'],
    queryFn: () => documentService.getDocumentVersions(docId!),
    enabled: !!docId,
  });
}

export function useRollbackVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      versionId,
    }: {
      docId: string;
      versionId: string;
    }) => documentService.rollbackDocumentVersion(docId, versionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['document', variables.docId, 'versions'],
      });
    },
  });
}

export function useSearchDocuments(teamId: string | undefined, q: string) {
  return useQuery({
    queryKey: ['documents', 'search', teamId, q],
    queryFn: () => documentService.searchDocuments(teamId!, q),
    enabled: !!teamId && q.length > 0,
  });
}

export function useDocumentContent(docId: string | undefined) {
  return useQuery({
    queryKey: ['document', docId, 'content'],
    queryFn: () => documentService.getDocumentContent(docId!),
    enabled: !!docId,
  });
}

export function useFileContent(fileUrl: string | undefined) {
  return useQuery({
    queryKey: ['fileContent', fileUrl],
    queryFn: () => documentService.fetchFileContent(fileUrl!),
    enabled: !!fileUrl,
  });
}

export function useSaveDocumentContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      content,
    }: {
      docId: string;
      content: string;
    }) => documentService.saveDocumentContent(docId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['document', variables.docId],
      });
      queryClient.invalidateQueries({
        queryKey: ['document', variables.docId, 'content'],
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useCreateShareLink() {
  return useMutation({
    mutationFn: ({
      docId,
      data,
    }: {
      docId: string;
      data: {
        permission: 'view' | 'edit' | 'comment';
        accessCode?: string;
        expiresAt?: string;
      };
    }) => documentService.createShareLink(docId, data),
  });
}
