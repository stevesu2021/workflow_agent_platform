export interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  chunk_count: number;
  extra_metadata?: {
    excel_columns?: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseGroup {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'excel' | 'pageindex';
  is_published: boolean;
  group_id?: string;
  group_name?: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
  documents?: Document[];
}

export interface KnowledgeBaseCreate {
  name: string;
  description?: string;
  type?: 'text' | 'excel' | 'pageindex';
  group_id?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface PageIndexNode {
  title: string;
  start_index: number;
  end_index: number;
  node_id: string;
  summary: string;
}

export interface PageIndexSearchResult {
  node: PageIndexNode;
  page_content: string;
  score: number;
}

export interface PageIndexSearchResponse {
  results: PageIndexSearchResult[];
  prompt?: string;
}
