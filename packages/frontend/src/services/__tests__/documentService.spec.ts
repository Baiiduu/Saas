/**
 * @jest-environment node
 */

import {
  uploadFile,
  saveDocumentContent,
  getDocumentContent,
  fetchFileContent,
} from '../documentService';
import * as api from '../api';

jest.mock('../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

const mockedGet = jest.mocked(api.get);
const mockedPost = jest.mocked(api.post);
const mockedPatch = jest.mocked(api.patch);

describe('documentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should call post with /documents and FormData', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content']), 'test.txt');

      mockedPost.mockResolvedValue({ id: 'doc-1' });

      const result = await uploadFile(formData);

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith('/documents', formData);
      expect(result).toEqual({ id: 'doc-1' });
    });

    it('should NOT set Content-Type header on the request config', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['data']), 'file.txt');

      mockedPost.mockResolvedValue({ id: 'doc-2' });

      await uploadFile(formData);

      const callArgs = mockedPost.mock.calls[0];
      // callArgs[0] = url, callArgs[1] = data, callArgs[2] = config
      expect(callArgs[0]).toBe('/documents');
      expect(callArgs[1]).toBe(formData);

      // Config should NOT be passed as third argument (let axios handle Content-Type)
      expect(callArgs.length).toBe(2);
    });

    it('should handle upload errors gracefully', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      const uploadError = new Error('Upload failed');
      mockedPost.mockRejectedValue(uploadError);

      await expect(uploadFile(formData)).rejects.toThrow('Upload failed');
    });
  });

  describe('saveDocumentContent', () => {
    it('should call patch with /documents/:docId/content and { content }', async () => {
      const docId = 'doc-123';
      const content = '# Hello\n\nThis is **markdown** content.';
      const expectedResponse = { id: docId, content };
      mockedPatch.mockResolvedValue(expectedResponse);

      const result = await saveDocumentContent(docId, content);

      expect(mockedPatch).toHaveBeenCalledTimes(1);
      expect(mockedPatch).toHaveBeenCalledWith(`/documents/${docId}/content`, { content });
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate save errors', async () => {
      const saveError = new Error('Save failed');
      mockedPatch.mockRejectedValue(saveError);

      await expect(saveDocumentContent('doc-1', 'content')).rejects.toThrow('Save failed');
    });
  });

  describe('getDocumentContent', () => {
    it('should call get with /documents/:docId/content and return content object', async () => {
      const docId = 'doc-456';
      const expected = { id: docId, name: 'test.md', content: '# Markdown', updatedAt: '2024-01-01T00:00:00Z', creatorId: 'user-1' };
      mockedGet.mockResolvedValue(expected);

      const result = await getDocumentContent(docId);

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet).toHaveBeenCalledWith(`/documents/${docId}/content`);
      expect(result).toEqual(expected);
    });
  });

  describe('fetchFileContent', () => {
    it('should call api.get with fileUrl and responseType text', async () => {
      const fileUrl = 'https://storage.example.com/file.txt';
      const expectedContent = 'file content here';
      mockedGet.mockResolvedValue({ data: expectedContent });

      const result = await fetchFileContent(fileUrl);

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet).toHaveBeenCalledWith(fileUrl, { responseType: 'text' });
      expect(result).toBe(expectedContent);
    });

    it('should propagate network errors', async () => {
      const networkError = new Error('Network Error');
      mockedGet.mockRejectedValue(networkError);

      await expect(fetchFileContent('https://example.com/file.txt')).rejects.toThrow('Network Error');
    });
  });
});
