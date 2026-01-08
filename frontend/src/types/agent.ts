export interface Agent {
  id: string;
  name: string;
  description?: string;
  icon?: string;
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
  flow_json: Record<string, any>;
}
