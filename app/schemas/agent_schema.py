from typing import List, Dict, Any, Optional, Union, Literal
from pydantic import BaseModel, Field
import uuid

class Position(BaseModel):
    x: float
    y: float

class NodeData(BaseModel):
    label: Optional[str] = None
    # Common fields
    model: Optional[str] = None
    prompt: Optional[str] = None
    temperature: Optional[float] = 0.7
    # Tool fields
    tool_id: Optional[str] = None
    tool_config: Optional[Dict[str, Any]] = None
    # Logic fields
    condition: Optional[str] = None
    # Knowledge fields
    knowledge_id: Optional[str] = None
    
    class Config:
        extra = "allow"

class Node(BaseModel):
    id: str
    type: Literal['start', 'end', 'llm', 'tool', 'agent', 'condition', 'knowledge', 'input', 'output']
    position: Optional[Position] = None
    data: NodeData = Field(default_factory=NodeData)

class Edge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    condition: Optional[str] = None # For branching

class AgentGraph(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    flow_json: AgentGraph

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    flow_json: Optional[AgentGraph] = None

class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: Any
    updated_at: Any
    latest_version: Optional[int] = None
