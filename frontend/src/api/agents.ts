import type { Agent, AgentCreate } from '../types/agent';

const BASE_URL = '/api/agents';

export const agentsApi = {
  // 获取所有智能体
  getAll: async (): Promise<Agent[]> => {
    const response = await fetch(`${BASE_URL}/`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
  },

  // 获取单个智能体
  getById: async (id: string): Promise<Agent> => {
    const response = await fetch(`${BASE_URL}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch agent');
    return response.json();
  },

  // 创建智能体
  create: async (agent: AgentCreate): Promise<Agent> => {
    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agent),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create agent error:', errorData);
        throw new Error(`Failed to create agent: ${JSON.stringify(errorData)}`);
    }
    return response.json();
  },

  // 更新智能体
  update: async (id: string, agent: Partial<AgentCreate>): Promise<Agent> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agent),
    });
    if (!response.ok) throw new Error('Failed to update agent');
    return response.json();
  },

  // 删除智能体
  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete agent');
  },

  // 导出智能体 YAML
  exportYaml: async (id: string): Promise<{ yaml: string; filename: string }> => {
    const response = await fetch(`${BASE_URL}/${id}/export`);
    if (!response.ok) throw new Error('Failed to export agent');
    return response.json();
  },

  // 获取智能体流程图 JSON
  getFlow: async (id: string): Promise<any> => {
      const response = await fetch(`${BASE_URL}/${id}/flow`);
      if (!response.ok) throw new Error('Failed to fetch agent flow');
      return response.json();
  },
};
