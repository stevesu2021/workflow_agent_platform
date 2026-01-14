from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel

from app.core.database import get_session
from app.models.ai_resource import AiResource
from app.services.mcp_service import mcp_service

router = APIRouter()

# --- Schemas ---

class MCPServerConfig(BaseModel):
    command: str
    args: List[str] = []
    env: Dict[str, str] = {}

class MCPServerCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: MCPServerConfig

class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[MCPServerConfig] = None

class MCPServerResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    config: Dict[str, Any]
    is_enabled: bool
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True

class MCPToolResponse(BaseModel):
    name: str
    description: Optional[str] = None
    inputSchema: Dict[str, Any]

# --- Endpoints ---

@router.get("/", response_model=List[MCPServerResponse])
async def get_mcp_servers(db: AsyncSession = Depends(get_session)):
    """List all registered MCP servers."""
    statement = select(AiResource).where(AiResource.type == "mcp_server")
    result = await db.execute(statement)
    return result.scalars().all()

@router.post("/", response_model=MCPServerResponse)
async def create_mcp_server(server: MCPServerCreate, db: AsyncSession = Depends(get_session)):
    """Register a new MCP server."""
    db_server = AiResource(
        name=server.name,
        description=server.description,
        type="mcp_server",
        endpoint="stdio",  # Placeholder for MCP servers which use stdio
        config=server.config.model_dump(),
        is_enabled=True
    )
    db.add(db_server)
    await db.commit()
    await db.refresh(db_server)
    return db_server

@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(server_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get details of a specific MCP server."""
    statement = select(AiResource).where(
        AiResource.id == server_id, 
        AiResource.type == "mcp_server"
    )
    result = await db.execute(statement)
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    return server

@router.put("/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(server_id: UUID, server_update: MCPServerUpdate, db: AsyncSession = Depends(get_session)):
    """Update an MCP server configuration."""
    statement = select(AiResource).where(
        AiResource.id == server_id, 
        AiResource.type == "mcp_server"
    )
    result = await db.execute(statement)
    db_server = result.scalars().first()
    
    if not db_server:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    
    if server_update.name is not None:
        db_server.name = server_update.name
    if server_update.description is not None:
        db_server.description = server_update.description
    if server_update.config is not None:
        db_server.config = server_update.config.model_dump()
        
    db.add(db_server)
    await db.commit()
    await db.refresh(db_server)
    return db_server

@router.delete("/{server_id}")
async def delete_mcp_server(server_id: UUID, db: AsyncSession = Depends(get_session)):
    """Delete an MCP server."""
    statement = select(AiResource).where(
        AiResource.id == server_id, 
        AiResource.type == "mcp_server"
    )
    result = await db.execute(statement)
    db_server = result.scalars().first()
    
    if not db_server:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    
    await db.delete(db_server)
    await db.commit()
    return {"message": "MCP Server deleted successfully"}

@router.post("/{server_id}/tools", response_model=List[MCPToolResponse])
async def list_mcp_server_tools(server_id: UUID, db: AsyncSession = Depends(get_session)):
    """
    Connect to the MCP server and list available tools.
    This triggers a real-time connection to the server process.
    """
    statement = select(AiResource).where(
        AiResource.id == server_id, 
        AiResource.type == "mcp_server"
    )
    result = await db.execute(statement)
    server = result.scalars().first()
    
    if not server:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    
    try:
        tools = await mcp_service.list_tools(server)
        return tools
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tools: {str(e)}")
