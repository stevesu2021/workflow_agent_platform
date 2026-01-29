import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, JSON
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class KnowledgeBaseType:
    TEXT = "text"
    EXCEL = "excel"
    PAGEINDEX = "pageindex"

class KnowledgeBaseGroup(SQLModel, table=True):
    __tablename__ = "knowledge_base_groups"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    knowledge_bases: List["KnowledgeBase"] = Relationship(back_populates="group")

class KnowledgeBase(SQLModel, table=True):
    __tablename__ = "knowledge_bases"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    type: str = Field(default=KnowledgeBaseType.TEXT, index=True)  # text or excel
    parser_type: Optional[str] = Field(default="PaddleOCR") # DeepSeek OCR, PaddleOCR, Vision LLM, MinerU
    is_published: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="knowledge_base_groups.id")

    documents: List["Document"] = Relationship(back_populates="knowledge_base")
    group: Optional[KnowledgeBaseGroup] = Relationship(back_populates="knowledge_bases")

class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(foreign_key="knowledge_bases.id")
    filename: str
    file_path: str
    file_type: str # pdf, docx, txt, md, xlsx, xls
    status: str = Field(default="pending") # pending, processing, completed, error
    error_message: Optional[str] = None
    chunk_count: int = Field(default=0)
    # Use extra_metadata instead of metadata (reserved name in SQLAlchemy)
    extra_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column("metadata", JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    knowledge_base: Optional[KnowledgeBase] = Relationship(back_populates="documents")
