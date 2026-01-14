import axios from 'axios';
import type { Tool, ToolCreate, ToolUpdate } from '../types/tool';

const API_BASE_URL = 'http://localhost:8001/tools/';

export const getTools = async (): Promise<Tool[]> => {
  const response = await axios.get(API_BASE_URL);
  return response.data;
};

export const getTool = async (id: string): Promise<Tool> => {
  const response = await axios.get(`${API_BASE_URL}/${id}`);
  return response.data;
};

export const createTool = async (tool: ToolCreate): Promise<Tool> => {
  const response = await axios.post(API_BASE_URL, tool);
  return response.data;
};

export const updateTool = async (id: string, tool: ToolUpdate): Promise<Tool> => {
  const response = await axios.put(`${API_BASE_URL}/${id}`, tool);
  return response.data;
};

export const deleteTool = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/${id}`);
};
