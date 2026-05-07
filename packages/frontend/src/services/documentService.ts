import api, { get, post, patch, del } from './api';
import type { IDocument } from '@saas/shared-types';

export function getDocuments(
  parentId?: string,
  teamId?: string
): Promise<IDocument[]> {
  const params: Record<string, string> = {};
  if (parentId) params.parentId = parentId;
  if (teamId) params.teamId = teamId;
  return get<IDocument[]>('/documents', { params });
}

export function getDocumentTree(teamId?: string): Promise<IDocument[]> {
  const params: Record<string, string | boolean> = { tree: true };
  if (teamId) params.teamId = teamId;
  return get<IDocument[]>('/documents', { params });
}

export function getDocument(id: string): Promise<IDocument> {
  return get<IDocument>(`/documents/${id}`);
}

export function createFolder(data: {
  name: string;
  parentId?: string;
  teamId: string;
}): Promise<IDocument> {
  return post<IDocument>('/documents', { ...data, type: 'FOLDER' });
}

export function uploadFile(data: FormData): Promise<IDocument> {
  // Do not set Content-Type — let browser set multipart/form-data with boundary
  return post<IDocument>('/documents', data);
}

export function updateDocument(
  id: string,
  data: Partial<{ name: string; parentId?: string | null }>
): Promise<IDocument> {
  return patch<IDocument>(`/documents/${id}`, data);
}

export function getDocumentVersions(docId: string): Promise<any[]> {
  return get<any[]>(`/documents/${docId}/versions`);
}

export function rollbackDocumentVersion(docId: string, versionId: string): Promise<any> {
  return post<any>(`/documents/${docId}/versions/${versionId}/rollback`);
}

export function searchDocuments(teamId: string, q: string): Promise<IDocument[]> {
  return get<IDocument[]>('/documents/search', { params: { q, teamId } });
}

export function saveDocumentContent(docId: string, content: string): Promise<IDocument> {
  return patch<IDocument>(`/documents/${docId}/content`, { content });
}

export function deleteDocument(id: string): Promise<void> {
  return del<void>(`/documents/${id}`);
}

// Get document content separately
export function getDocumentContent(docId: string): Promise<{ id: string; name: string; content: string | null; updatedAt: string; creatorId: string }> {
  return get(`/documents/${docId}/content`);
}

// Fetch raw file content from storage URL
export async function fetchFileContent(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file content: ${response.statusText}`);
  return response.text();
}

export function createShareLink(
  docId: string,
  data: {
    permission: 'view' | 'edit' | 'comment';
    accessCode?: string;
    expiresAt?: string;
  }
): Promise<{ shareToken: string; accessCode?: string; url: string }> {
  return post<{ shareToken: string; accessCode?: string; url: string }>(
    `/documents/${docId}/share`,
    data
  );
}
