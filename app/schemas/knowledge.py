import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "text"  # text, excel, or pageindex
    group_id: Optional[uuid.UUID] = None

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class KnowledgeBaseGroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class KnowledgeBaseGroupCreate(KnowledgeBaseGroupBase):
    pass

class KnowledgeBaseGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class KnowledgeBaseGroupResponse(KnowledgeBaseGroupBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class DocumentResponse(BaseModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    filename: str
    file_type: str
    status: str
    error_message: Optional[str]
    chunk_count: int
    extra_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: uuid.UUID
    is_published: bool
    group_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentResponse] = []

class KnowledgeBaseListResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    type: str
    is_published: bool
    document_count: int
    group_id: Optional[uuid.UUID]
    group_name: Optional[str] = None
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

class PageIndexNode(BaseModel):
    title: str
    start_index: int
    end_index: int
    node_id: str
    summary: str

class PageIndexStructure(BaseModel):
    doc_name: str
    structure: List[PageIndexNode]

class PageIndexSearchResult(BaseModel):
    node: PageIndexNode
    page_content: str
    score: float

class PageIndexSearchResponse(BaseModel):
    results: List[PageIndexSearchResult]
    prompt: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]

class BatchDeleteRequest(BaseModel):
    ids: List[uuid.UUID]
