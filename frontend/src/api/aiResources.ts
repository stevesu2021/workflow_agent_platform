import type { AiResource, AiResourceCreate, AiResourceUpdate } from '../types/aiResource';

// Helper to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'API request failed');
  }
  return response.json();
};

export const aiResourcesApi = {
  getAll: async (): Promise<AiResource[]> => {
    const response = await fetch('/api/ai-resources/');
    return handleResponse(response);
  },

  getAvailable: async (type?: string): Promise<{ data: any[] }> => {
    const url = type 
      ? `/api/ai-resources/available?type=${type}`
      : '/api/ai-resources/available';
    const response = await fetch(url);
    return handleResponse(response);
  },

  create: async (resource: AiResourceCreate): Promise<AiResource> => {
    const response = await fetch('/api/ai-resources/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });
    return handleResponse(response);
  },

  update: async (id: string, resource: AiResourceUpdate): Promise<AiResource> => {
    const response = await fetch(`/api/ai-resources/${id}`, {
      method: 'PUT', // Using PUT as per backend implementation
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`/api/ai-resources/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  testConnection: async (id: string): Promise<{ success: boolean; message: string; latency_ms?: number }> => {
    const response = await fetch(`/api/ai-resources/${id}/test-connection`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  setDefault: async (id: string): Promise<void> => {
    const response = await fetch('/api/ai-resources/set-default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id: id }),
    });
    return handleResponse(response);
  },

  testResource: async (id: string, payload: any): Promise<any> => {
    const response = await fetch(`/api/ai-resources/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },
};
