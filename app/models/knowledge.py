import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class KnowledgeBase(SQLModel, table=True):
    __tablename__ = "knowledge_bases"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    is_published: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    documents: List["Document"] = Relationship(back_populates="knowledge_base")

class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(foreign_key="knowledge_bases.id")
    filename: str
    file_path: str
    file_type: str # pdf, docx, txt, md
    status: str = Field(default="pending") # pending, processing, completed, error
    error_message: Optional[str] = None
    chunk_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    knowledge_base: Optional[KnowledgeBase] = Relationship(back_populates="documents")
