import type { KnowledgeBase, KnowledgeBaseCreate, Document, SearchResult, PageIndexSearchResponse } from '../types/knowledge';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'API request failed');
  }
  return response.json();
};

export const knowledgeApi = {
  list: async (): Promise<KnowledgeBase[]> => {
    const response = await fetch('/api/knowledge-bases/');
    return handleResponse(response);
  },

  create: async (data: KnowledgeBaseCreate): Promise<KnowledgeBase> => {
    const response = await fetch('/api/knowledge-bases/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  get: async (id: string): Promise<KnowledgeBase> => {
    const response = await fetch(`/api/knowledge-bases/${id}`);
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`/api/knowledge-bases/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  uploadDocument: async (id: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/knowledge-bases/${id}/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  uploadExcelDocument: async (id: string, formData: FormData): Promise<Document> => {
    const response = await fetch(`/api/knowledge-bases/${id}/upload-excel`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  processDocument: async (kbId: string, docId: string): Promise<void> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/process`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  getDocumentPreview: async (kbId: string, docId: string): Promise<{ content: string }> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/preview`);
    return handleResponse(response);
  },

  getDocumentChunks: async (kbId: string, docId: string): Promise<SearchResult[]> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/chunks`);
    return handleResponse(response);
  },

  search: async (id: string, query: string, topK: number = 10): Promise<{ results: SearchResult[] }> => {
    const response = await fetch(`/api/knowledge-bases/${id}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    });
    return handleResponse(response);
  },

  publish: async (id: string): Promise<KnowledgeBase> => {
    const response = await fetch(`/api/knowledge-bases/${id}/publish`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  unpublish: async (id: string): Promise<KnowledgeBase> => {
    const response = await fetch(`/api/knowledge-bases/${id}/unpublish`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  reprocessExcelDocument: async (kbId: string, docId: string): Promise<void> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/reprocess-excel`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // PageIndex APIs
  uploadPageIndexDocument: async (id: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/knowledge-bases/${id}/upload-pageindex`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  processPageIndexDocument: async (kbId: string, docId: string): Promise<void> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/process-pageindex`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  searchPageIndex: async (id: string, query: string, topK: number = 10, docId?: string): Promise<PageIndexSearchResponse> => {
    const params = new URLSearchParams();
    if (docId) params.append('doc_id', docId);

    const response = await fetch(`/api/knowledge-bases/${id}/pageindex-search?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    });
    return handleResponse(response);
  },

  getPageIndexNodes: async (kbId: string, docId: string): Promise<any> => {
    const response = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}/pageindex-nodes`);
    return handleResponse(response);
  }
};
