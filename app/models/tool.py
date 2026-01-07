import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class Tool(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    type: str # 'api', 'function'
    config: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class KnowledgeBase(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
