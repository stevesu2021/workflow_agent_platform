from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.agent import Agent, AgentVersion
from app.schemas.agent_schema import AgentCreate, AgentUpdate
import uuid

class AgentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_agent(self, agent_data: AgentCreate) -> Agent:
        # 1. Create Agent
        agent = Agent(
            name=agent_data.name,
            description=agent_data.description,
            icon=agent_data.icon
        )
        self.session.add(agent)
        await self.session.commit()
        await self.session.refresh(agent)
        
        # 2. Create Initial Version
        version = AgentVersion(
            agent_id=agent.id,
            version=1,
            flow_json=agent_data.flow_json.model_dump(),
            config={}
        )
        self.session.add(version)
        await self.session.commit()
        
        return agent

    async def get_agent(self, agent_id: uuid.UUID) -> Agent:
        result = await self.session.execute(select(Agent).where(Agent.id == agent_id))
        return result.scalars().first()

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
