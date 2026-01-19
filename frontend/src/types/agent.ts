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
  knowledge_bases?: string[];
  task_description?: string;
  vocabulary: string[];
  memory_config: {
    variables: Record<string, string>;
    tables: string[];
    snippets: string[];
  };
  prologue: string;
  resource_files?: ResourceFile[];
  io_config?: IOConfig;
}

export interface ResourceFile {
  name: string;
  status: string;
}

export interface IOConfig {
  inputs: IOField[];
  outputs: IOField[];
}

export interface IOField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'file' | 'number' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  default_value?: string | number | boolean;
  options?: string[]; // For select type
  file_types?: string[]; // For file type
  validation?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
  };
}

export const IO_FIELD_TYPES = [
  { value: 'text', label: 'Text Input', icon: 'Input' },
  { value: 'textarea', label: 'Text Area', icon: 'FileTextOutlined' },
  { value: 'number', label: 'Number', icon: 'Number' },
  { value: 'file', label: 'File Upload', icon: 'UploadOutlined' },
  { value: 'select', label: 'Dropdown', icon: 'Select' },
  { value: 'checkbox', label: 'Checkbox', icon: 'CheckSquareOutlined' },
] as const;

export const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Word (.doc)' },
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'txt', label: 'Text (.txt)' },
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'xls', label: 'Excel (.xls)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
  { value: 'image', label: 'Image (.png, .jpg, .gif)' },
] as const;
