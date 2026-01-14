import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

class ToolBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # 'api', 'function'
    config: Dict[str, Any] = {}

class ToolCreate(ToolBase):
    pass

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class ToolResponse(ToolBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
