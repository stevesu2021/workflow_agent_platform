import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON
from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class AgentBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None
    icon: Optional[str] = None

class Agent(AgentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    versions: List["AgentVersion"] = Relationship(back_populates="agent")

class AgentVersion(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_id: uuid.UUID = Field(foreign_key="agent.id")
    version: int
    flow_json: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    config: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    agent: Agent = Relationship(back_populates="versions")
    runs: List["WorkflowRun"] = Relationship(back_populates="agent_version")
