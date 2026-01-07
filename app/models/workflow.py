import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class WorkflowRun(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_version_id: uuid.UUID = Field(foreign_key="agentversion.id")
    status: str = Field(default="pending")
    inputs: Dict[str, Any] = Field(default={}, sa_column=Column(SQLiteJSON))
    outputs: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SQLiteJSON))
    logs: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(SQLiteJSON))
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    agent_version: "AgentVersion" = Relationship(back_populates="runs")
