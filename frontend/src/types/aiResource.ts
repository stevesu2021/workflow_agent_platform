export enum AiResourceType {
  TEXT_LLM = 'text_llm',
  VISION_LLM = 'vision_llm',
  OCR_PADDLE = 'ocr_paddle',
  OCR_DEEPSEEK = 'ocr_deepseek',
  EMBEDDING = 'embedding',
  RERANKER = 'reranker',
}

export const AiResourceTypeLabels: Record<string, string> = {
  [AiResourceType.TEXT_LLM]: 'Text LLM',
  [AiResourceType.VISION_LLM]: 'Vision LLM',
  [AiResourceType.OCR_PADDLE]: 'PaddleOCR',
  [AiResourceType.OCR_DEEPSEEK]: 'DeepSeek-OCR',
  [AiResourceType.EMBEDDING]: 'Embedding Model',
  [AiResourceType.RERANKER]: 'Reranker',
};

export interface AiResource {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  api_key?: string; // Optional for display (masked)
  config: Record<string, any>;
  is_enabled: boolean;
  is_default: boolean;
  description?: string;
  health_status: 'unknown' | 'healthy' | 'unhealthy';
  last_health_check_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AiResourceCreate {
  name: string;
  type: string;
  endpoint: string;
  api_key?: string;
  config?: Record<string, any>;
  is_enabled?: boolean;
  is_default?: boolean;
  description?: string;
}

export interface AiResourceUpdate {
  name?: string;
  type?: string;
  endpoint?: string;
  api_key?: string;
  config?: Record<string, any>;
  is_enabled?: boolean;
  is_default?: boolean;
  description?: string;
}
