from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.schemas.agent_schema import AgentCreate, AgentResponse, AgentGraph
from app.services.agent_service import AgentService
from app.services.generation_service import generate_agent_from_text
import uuid
from pydantic import BaseModel

class GenerateRequest(BaseModel):
    description: str

router = APIRouter()

@router.post("/generate", response_model=AgentGraph)
async def generate_agent(request: GenerateRequest):
    return await generate_agent_from_text(request.description)

@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    new_agent = await service.create_agent(agent)
    return AgentResponse(
        id=new_agent.id,
        name=new_agent.name,
        description=new_agent.description,
        created_at=new_agent.created_at,
        updated_at=new_agent.updated_at,
        latest_version=1
    )

@router.get("/", response_model=list[AgentResponse])
async def list_agents(session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    agents = await service.list_agents()
    return [
        AgentResponse(
            id=a.id,
            name=a.name,
            description=a.description,
            created_at=a.created_at,
            updated_at=a.updated_at
        ) for a in agents
    ]

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    agent = await service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        created_at=agent.created_at,
        updated_at=agent.updated_at
    )

@router.get("/{agent_id}/flow", response_model=dict)
async def get_agent_flow(agent_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    version = await service.get_latest_version(agent_id)
    if not version:
        raise HTTPException(status_code=404, detail="Agent flow not found")
    return version.flow_json

@router.get("/{agent_id}/export", response_model=dict)
async def export_agent_yaml(agent_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    yaml_content = await service.export_agent_yaml(agent_id)
    if not yaml_content:
        raise HTTPException(status_code=404, detail="Agent or version not found")
    return {"yaml": yaml_content, "filename": f"agent_{agent_id}.yaml"}

@router.delete("/{agent_id}")
async def delete_agent(agent_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    success = await service.delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent deleted successfully"}
