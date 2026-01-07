import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.models.ai_resource import AiResource

class AiResourceBase(BaseModel):
    name: str
    type: str
    endpoint: str
    config: Optional[Dict[str, Any]] = {}
    is_enabled: Optional[bool] = True
    is_default: Optional[bool] = False
    description: Optional[str] = None

class AiResourceCreate(AiResourceBase):
    api_key: Optional[str] = None

class AiResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    is_default: Optional[bool] = None
    description: Optional[str] = None

class AiResourceResponse(AiResourceBase):
    id: uuid.UUID
    health_status: str
    last_health_check_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # We generally don't want to return the full API key, maybe a masked one
    # But for editing, we might need to know if it's set. 
    # For now, let's exclude api_key from the default response or handle it carefully.
    # The requirement says "frontend only displays masked value".
    # We'll handle masking in the service or just not return it here if not needed for list.
    # But for "edit" we might need it? Usually we keep it empty if not changed.
    
class AiResourceListResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    is_default: bool
    is_enabled: bool
    description: Optional[str]
    health_status: str

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[float] = None
