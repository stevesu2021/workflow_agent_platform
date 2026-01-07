export interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  document_count?: number;
  documents?: Document[];
}

export interface KnowledgeBaseCreate {
  name: string;
  description?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}
