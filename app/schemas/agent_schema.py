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
    type: Literal['start', 'end', 'llm', 'tool', 'agent', 'condition', 'knowledge', 'input', 'output', 'doc_parser', 'excel_parser', 'mcp', 'vision', 'intent']
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
    type: Optional[str] = 'workflow'
    flow_json: Dict[str, Any] # Changed from AgentGraph to Dict to support both workflow and agentic structures
    config: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    type: Optional[str] = 'workflow'
    created_at: Any
    updated_at: Any
    latest_version: Optional[int] = None
    versions: Optional[List[Any]] = None
