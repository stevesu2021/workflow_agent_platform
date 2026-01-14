import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001/mcp';

export interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  config: MCPServerConfig;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MCPServerCreate {
  name: string;
  description?: string;
  config: MCPServerConfig;
}

export interface MCPServerUpdate {
  name?: string;
  description?: string;
  config?: MCPServerConfig;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export const getMCPServers = async (): Promise<MCPServer[]> => {
  const response = await axios.get(`${API_BASE_URL}/`);
  return response.data;
};

export const createMCPServer = async (server: MCPServerCreate): Promise<MCPServer> => {
  const response = await axios.post(`${API_BASE_URL}/`, server);
  return response.data;
};

export const updateMCPServer = async (id: string, server: MCPServerUpdate): Promise<MCPServer> => {
  const response = await axios.put(`${API_BASE_URL}/${id}`, server);
  return response.data;
};

export const deleteMCPServer = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/${id}`);
};

export const listMCPServerTools = async (id: string): Promise<MCPTool[]> => {
  const response = await axios.post(`${API_BASE_URL}/${id}/tools`);
  return response.data;
};
