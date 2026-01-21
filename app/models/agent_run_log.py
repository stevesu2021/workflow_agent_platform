"""
Agent Run Log Model

Stores logs for agent code generation and execution processes.
Used for tracking the loop-based code generation and testing workflow.
"""
import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, Text
from sqlalchemy import Column as SAColumn


class AgentRunLogBase(SQLModel):
    """Base model for AgentRunLog"""
    agent_id: uuid.UUID = Field(foreign_key="agent.id", index=True)
    loop_count: int = Field(default=0, index=True)
    stage: str = Field(index=True)  # "code_generation", "venv_setup", "running", "fixing"
    status: str = Field(index=True)  # "success", "error", "running"
    message: str = Field(sa_column=SAColumn(Text))


class AgentRunLog(AgentRunLogBase, table=True):
    """Database table for agent run logs"""
    __tablename__ = "agent_run_log"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
