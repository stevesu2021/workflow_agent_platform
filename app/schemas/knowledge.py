import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DocumentResponse(BaseModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    filename: str
    file_type: str
    status: str
    error_message: Optional[str]
    chunk_count: int
    created_at: datetime
    updated_at: datetime

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: uuid.UUID
    is_published: bool
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentResponse] = []

class KnowledgeBaseListResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    is_published: bool
    document_count: int
    created_at: datetime
    updated_at: datetime

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    score_threshold: float = 0.0

class SearchResult(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any]
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]
