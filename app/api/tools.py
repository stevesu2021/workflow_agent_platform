import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.schemas.tool_schema import ToolCreate, ToolUpdate, ToolResponse
from app.services.tool_service import ToolService

router = APIRouter()

@router.get("/", response_model=List[ToolResponse])
async def list_tools(session: AsyncSession = Depends(get_session)):
    service = ToolService(session)
    return await service.list_tools()

@router.post("/", response_model=ToolResponse)
async def create_tool(
    tool: ToolCreate,
    session: AsyncSession = Depends(get_session)
):
    service = ToolService(session)
    return await service.create_tool(tool)

@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(
    tool_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    service = ToolService(session)
    tool = await service.get_tool(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.put("/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: uuid.UUID,
    tool_update: ToolUpdate,
    session: AsyncSession = Depends(get_session)
):
    service = ToolService(session)
    tool = await service.update_tool(tool_id, tool_update)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.delete("/{tool_id}")
async def delete_tool(
    tool_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    service = ToolService(session)
    success = await service.delete_tool(tool_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tool not found")
    return {"message": "Tool deleted successfully"}
