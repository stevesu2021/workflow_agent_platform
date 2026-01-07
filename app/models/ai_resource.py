import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class AiResource(SQLModel, table=True):
    __tablename__ = "ai_resources"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    type: str = Field(index=True)  # text_llm, vision_llm, ocr_paddle, etc.
    endpoint: str
    api_key: Optional[str] = None  # In a real app, encrypt this
    config: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    is_enabled: bool = Field(default=True)
    is_default: bool = Field(default=False)
    description: Optional[str] = None
    health_status: str = Field(default="unknown")  # unknown, healthy, unhealthy
    last_health_check_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
