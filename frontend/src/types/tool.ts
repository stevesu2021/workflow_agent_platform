export interface Tool {
  id: string;
  name: string;
  description?: string;
  type: 'api' | 'function';
  config: Record<string, any>;
  created_at: string;
}

export interface ToolCreate {
  name: string;
  description?: string;
  type: 'api' | 'function';
  config: Record<string, any>;
}

export interface ToolUpdate {
  name?: string;
  description?: string;
  type?: 'api' | 'function';
  config?: Record<string, any>;
}
