from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_session
from app.schemas.agent_schema import AgentCreate, AgentResponse, AgentGraph
from app.services.agent_service import AgentService
from app.services.generation_service import generate_agent_from_text
from app.services.requirement_decomposition_service import RequirementDecompositionService
import uuid
from pydantic import BaseModel
from typing import Dict, Any, Optional

class GenerateRequest(BaseModel):
    description: str

router = APIRouter()

@router.post("/generate", response_model=AgentGraph)
async def generate_agent(request: GenerateRequest):
    return await generate_agent_from_text(request.description)

@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    # Ensure flow_json is a dict
    if hasattr(agent.flow_json, 'model_dump'):
        flow_json = agent.flow_json.model_dump()
    elif isinstance(agent.flow_json, dict):
        flow_json = agent.flow_json
    else:
        flow_json = {}

    # Create agent with dict flow_json
    from app.schemas.agent_schema import AgentCreate as AgentCreateModel
    agent_data = AgentCreateModel(
        name=agent.name,
        description=agent.description,
        icon=agent.icon,
        type=agent.type,
        flow_json=flow_json,
        config=agent.config
    )

    new_agent = await service.create_agent(agent_data)
    return AgentResponse(
        id=new_agent.id,
        name=new_agent.name,
        description=new_agent.description,
        type=new_agent.type,
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
            type=a.type,
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
        type=agent.type,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        versions=agent.versions
    )

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: uuid.UUID, agent: AgentCreate, session: AsyncSession = Depends(get_session)):
    service = AgentService(session)
    # Ensure flow_json is a dict
    if hasattr(agent.flow_json, 'model_dump'):
        flow_json = agent.flow_json.model_dump()
    elif isinstance(agent.flow_json, dict):
        flow_json = agent.flow_json
    else:
        flow_json = {}

    # Create agent with dict flow_json
    from app.schemas.agent_schema import AgentCreate as AgentCreateModel
    agent_data = AgentCreateModel(
        name=agent.name,
        description=agent.description,
        icon=agent.icon,
        type=agent.type,
        flow_json=flow_json,
        config=agent.config
    )

    updated_agent = await service.update_agent(agent_id, agent_data)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse(
        id=updated_agent.id,
        name=updated_agent.name,
        description=updated_agent.description,
        type=updated_agent.type,
        created_at=updated_agent.created_at,
        updated_at=updated_agent.updated_at,
        latest_version=len(updated_agent.versions)
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


class DecompositionRequest(BaseModel):
    """Request model for requirement decomposition."""
    agent_data: Dict[str, Any]
    config: Dict[str, Any]


@router.post("/analyze-requirements")
async def analyze_requirements(
    request: DecompositionRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Analyze agent requirements and generate detailed decomposition document.

    This endpoint uses the thinking LLM to:
    1. Analyze resource files
    2. Design LangGraph architecture
    3. Define model configurations
    4. Detail knowledge base and tool usage
    5. Break down tasks into steps
    6. Define output format
    """
    try:
        service = RequirementDecompositionService(session)
        decomposition_doc = await service.decompose_requirements(
            agent_data=request.agent_data,
            config=request.config
        )
        return {"decomposition": decomposition_doc}
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in analyze_requirements: {e}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Requirement decomposition failed: {str(e)}"
        )
