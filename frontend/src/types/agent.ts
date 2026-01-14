export interface Agent {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  type: 'workflow' | 'agentic';
  created_at?: string;
  updated_at?: string;
  versions?: AgentVersion[];
}

export interface AgentVersion {
  id?: string;
  agent_id?: string;
  version?: number;
  flow_json: Record<string, any>;
  config?: Record<string, any>;
  created_at?: string;
}

export interface AgentCreate {
  name: string;
  description?: string;
  icon?: string;
  type?: 'workflow' | 'agentic';
  flow_json: Record<string, any>;
  config?: Record<string, any>;
}

// Agentic Config Types
export interface AgenticConfig {
  model_thinking: string;
  model_summary: string;
  max_thoughts: number;
  tools: string[];
  vocabulary: string[];
  memory_config: {
    variables: Record<string, string>;
    tables: string[];
    snippets: string[];
  };
  prologue: string;
}
