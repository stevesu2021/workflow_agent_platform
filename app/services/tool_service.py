import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tool import Tool
from app.schemas.tool_schema import ToolCreate, ToolUpdate

class ToolService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_tools(self) -> List[Tool]:
        result = await self.session.execute(select(Tool))
        return result.scalars().all()

    async def get_tool(self, tool_id: uuid.UUID) -> Optional[Tool]:
        result = await self.session.execute(select(Tool).where(Tool.id == tool_id))
        return result.scalars().first()

    async def create_tool(self, tool_create: ToolCreate) -> Tool:
        tool = Tool(
            name=tool_create.name,
            description=tool_create.description,
            type=tool_create.type,
            config=tool_create.config
        )
        self.session.add(tool)
        await self.session.commit()
        await self.session.refresh(tool)
        return tool

    async def update_tool(self, tool_id: uuid.UUID, tool_update: ToolUpdate) -> Optional[Tool]:
        tool = await self.get_tool(tool_id)
        if not tool:
            return None
        
        update_data = tool_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tool, key, value)
            
        self.session.add(tool)
        await self.session.commit()
        await self.session.refresh(tool)
        return tool

    async def delete_tool(self, tool_id: uuid.UUID) -> bool:
        tool = await self.get_tool(tool_id)
        if not tool:
            return False
            
        await self.session.delete(tool)
        await self.session.commit()
        return True
