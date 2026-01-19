from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.agent import Agent, AgentVersion
from app.schemas.agent_schema import AgentCreate
from typing import Optional
import uuid

class AgentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_agent(self, agent_data: AgentCreate) -> Agent:
        # 1. Create Agent
        agent = Agent(
            name=agent_data.name,
            description=agent_data.description,
            icon=agent_data.icon,
            type=agent_data.type  # Include type field to support agentic/workflow types
        )
        self.session.add(agent)
        await self.session.commit()
        await self.session.refresh(agent)

        # 2. Create Initial Version
        # Ensure flow_json is a dict
        if hasattr(agent_data.flow_json, 'model_dump'):
            flow_json = agent_data.flow_json.model_dump()
        elif isinstance(agent_data.flow_json, dict):
            flow_json = agent_data.flow_json
        else:
            flow_json = {}

        version = AgentVersion(
            agent_id=agent.id,
            version=1,
            flow_json=flow_json,
            config={}
        )
        self.session.add(version)
        await self.session.commit()

        return agent

    async def get_agent(self, agent_id: uuid.UUID) -> Agent:
        from sqlalchemy.orm import selectinload
        result = await self.session.execute(
            select(Agent)
            .options(selectinload(Agent.versions))
            .where(Agent.id == agent_id)
        )
        return result.scalars().first()

    async def update_agent(self, agent_id: uuid.UUID, agent_data: AgentCreate) -> Optional[Agent]:
        from datetime import datetime
        from sqlalchemy import update

        # First check if agent exists
        agent = await self.get_agent(agent_id)
        if not agent:
            return None

        # Ensure flow_json is a dict
        if hasattr(agent_data.flow_json, 'model_dump'):
            flow_json = agent_data.flow_json.model_dump()
        elif isinstance(agent_data.flow_json, dict):
            flow_json = agent_data.flow_json
        else:
            flow_json = {}

        # Update agent using update statement for better async handling
        update_stmt = (
            update(Agent)
            .where(Agent.id == agent_id)
            .values(
                name=agent_data.name,
                description=agent_data.description,
                icon=agent_data.icon,
                type=agent_data.type,  # Include type field to support changing agent type
                updated_at=datetime.utcnow()
            )
        )
        await self.session.execute(update_stmt)

        # Get latest version
        latest_version = await self.get_latest_version(agent_id)
        if latest_version:
            # Update version using update statement
            update_version_stmt = (
                update(AgentVersion)
                .where(AgentVersion.id == latest_version.id)
                .values(
                    flow_json=flow_json,
                    config=agent_data.config or {}
                )
            )
            await self.session.execute(update_version_stmt)
        else:
            # Create new version if none exists
            version = AgentVersion(
                agent_id=agent.id,
                version=1,
                flow_json=flow_json,
                config=agent_data.config or {}
            )
            self.session.add(version)

        await self.session.commit()

        # Refresh and return updated agent
        from sqlalchemy.orm import selectinload

        # Re-query the agent with versions relationship loaded
        result = await self.session.execute(
            select(Agent)
            .options(selectinload(Agent.versions))
            .where(Agent.id == agent_id)
        )
        agent = result.scalars().first()

        return agent

    async def list_agents(self) -> list[Agent]:
        result = await self.session.execute(select(Agent))
        return result.scalars().all()

    async def get_latest_version(self, agent_id: uuid.UUID) -> AgentVersion:
        # Simple logic: get max version
        stmt = select(AgentVersion).where(AgentVersion.agent_id == agent_id).order_by(AgentVersion.version.desc())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def delete_agent(self, agent_id: uuid.UUID) -> bool:
        agent = await self.get_agent(agent_id)
        if not agent:
            return False
        
        # Manually delete versions first because SQLite FK constraints might be tricky 
        # or SQLAlchemy relationship cascade might not trigger if not loaded
        # However, with "delete-orphan" cascade configured on relationship, 
        # we usually need to load the object with relationship or let DB handle it.
        # Given the error "NOT NULL constraint failed: agentversion.agent_id", 
        # it seems SQLAlchemy is trying to set agent_id to NULL instead of deleting.
        # This happens when cascade is not set to "delete".
        
        # To be safe and explicit:
        stmt = select(AgentVersion).where(AgentVersion.agent_id == agent_id)
        result = await self.session.execute(stmt)
        versions = result.scalars().all()
        for version in versions:
            await self.session.delete(version)
            
        await self.session.delete(agent)
        await self.session.commit()
        return True

    async def export_agent_yaml(self, agent_id: uuid.UUID) -> Optional[str]:
        import yaml
        
        agent = await self.get_agent(agent_id)
        if not agent:
            return None
            
        version = await self.get_latest_version(agent_id)
        if not version:
            return None
            
        # Structure the export data
        export_data = {
            "agent": {
                "name": agent.name,
                "description": agent.description,
                "version": version.version
            },
            "flow": version.flow_json,
            "config": version.config
        }
        
        return yaml.dump(export_data, default_flow_style=False, sort_keys=False, allow_unicode=True)

