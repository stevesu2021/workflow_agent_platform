from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_session
from app.schemas.agent_schema import AgentCreate, AgentResponse, AgentGraph
from app.services.agent_service import AgentService
from app.services.generation_service import generate_agent_from_text
from app.services.requirement_decomposition_service import RequirementDecompositionService
from app.services.openmanus_langgraph_generator import get_generator
import uuid
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
import json

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


class GenerateCodeRequest(BaseModel):
    """Request model for generating OpenManus + LangGraph code."""
    agent_id: str
    openmanus_path: Optional[str] = None


@router.post("/generate-code")
async def generate_agent_code(
    request: GenerateCodeRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Generate OpenManus + LangGraph implementation code for an agent.

    This endpoint:
    1. Retrieves the agent and its decomposition document
    2. Generates Python code files compatible with OpenManus + LangGraph
    3. Saves files to $OPENMANUS_PATH/workspace/$agent_name/
    4. Returns the generated code structure and graph visualization
    """
    try:
        # Get agent
        service = AgentService(session)
        agent = await service.get_agent(uuid.UUID(request.agent_id))
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Get latest version with config
        from sqlalchemy import select
        from app.models.agent import AgentVersion
        stmt = (
            select(AgentVersion)
            .where(AgentVersion.agent_id == agent.id)
            .order_by(AgentVersion.version.desc())
        )
        result = await session.execute(stmt)
        version = result.scalars().first()

        if not version or not version.config:
            raise HTTPException(
                status_code=400,
                detail="Agent has no configuration. Please save the agent first."
            )

        config = version.config
        decomposition_doc = config.get("decomposition_doc")

        if not decomposition_doc:
            raise HTTPException(
                status_code=400,
                detail="No decomposition document found. Please generate requirements decomposition first."
            )

        # Generate code
        generator = get_generator()
        if request.openmanus_path:
            generator.openmanus_path = request.openmanus_path

        files = generator.generate_agent_code(
            agent_name=agent.name,
            agent_description=agent.description or "",
            decomposition_doc=decomposition_doc,
            config=config
        )

        # Save files to workspace
        workspace_dir = os.path.join(generator.workspace_base, generator._sanitize_name(agent.name))
        os.makedirs(workspace_dir, exist_ok=True)

        saved_files = {}
        for file_name, file_content in files.items():
            file_path = os.path.join(workspace_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file_content)
            saved_files[file_name] = file_path

        # Parse graph data for visualization
        graph_data = json.loads(files.get("graph.json", "{}"))

        return {
            "success": True,
            "message": "Code generated successfully",
            "workspace_dir": workspace_dir,
            "files": saved_files,
            "graph": graph_data,
            "agent_name": agent.name
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in generate_agent_code: {e}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Code generation failed: {str(e)}"
        )


class RunAgentRequest(BaseModel):
    """Request model for running agent."""
    agent_id: str
    inputs: Dict[str, Any]
    files: Optional[List[UploadFile]] = None


@router.post("/run-agent")
async def run_agent(
    agent_id: str = Form(...),
    inputs: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    session: AsyncSession = Depends(get_session)
):
    """
    Run an OpenManus + LangGraph agent with the given inputs.

    This endpoint:
    1. Retrieves the agent configuration
    2. Executes the generated agent.py code
    3. Returns the output results
    """
    import subprocess
    import tempfile
    import shutil
    from pathlib import Path

    try:
        # Get agent
        service = AgentService(session)
        agent = await service.get_agent(uuid.UUID(agent_id))
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Get config
        from sqlalchemy import select
        from app.models.agent import AgentVersion
        stmt = (
            select(AgentVersion)
            .where(AgentVersion.agent_id == agent.id)
            .order_by(AgentVersion.version.desc())
        )
        result = await session.execute(stmt)
        version = result.scalars().first()

        if not version or not version.config:
            raise HTTPException(
                status_code=400,
                detail="Agent has no configuration. Please save the agent first."
            )

        config = version.config
        inputs_data = json.loads(inputs) if inputs else {}

        # Get workspace directory
        from app.services.openmanus_langgraph_generator import get_generator
        generator = get_generator()
        workspace_dir = os.path.join(generator.workspace_base, generator._sanitize_name(agent.name))

        agent_file = os.path.join(workspace_dir, "agent.py")
        if not os.path.exists(agent_file):
            raise HTTPException(
                status_code=400,
                detail=f"Agent code not found. Please generate code first. Expected: {agent_file}"
            )

        # Save uploaded files to temp directory
        temp_files = {}
        file_inputs = {}
        for file in files:
            file_path = os.path.join(workspace_dir, "uploads", file.filename)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(await file.read())
            file_inputs[file.filename] = file_path
            # Also store the path for the input name
            # Extract field name from format file_{field_name}
            field_name = file.filename.replace("file_", "").replace(str(agent.id), "")
            if field_name in inputs_data:
                inputs_data[field_name + "_path"] = file_path

        # Prepare run script
        run_script = f'''
import sys
import json
import os

# Add workspace to path
sys.path.insert(0, "{workspace_dir}")

# Set environment variables for LLM
os.environ["LLM_API_KEY"] = os.getenv("LLM_API_KEY", "")
os.environ["LLM_BASE_URL"] = os.getenv("LLM_BASE_URL", "")

# Import and run agent
from agent import create_agent

# Run agent
agent = create_agent()
user_input = {json.dumps(inputs_data, ensure_ascii=False)}

try:
    result = agent.run(user_input)
    print(json.dumps({{"success": True, "result": str(result)}}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({{"success": False, "error": str(e)}}, ensure_ascii=False))
'''

        script_path = os.path.join(workspace_dir, "run_agent.py")
        with open(script_path, "w") as f:
            f.write(run_script)

        # Run the agent script
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes timeout
            cwd=workspace_dir,
            env={**os.environ, "PYTHONPATH": workspace_dir}
        )

        # Clean up uploaded files
        for file_path in file_inputs.values():
            if os.path.exists(file_path):
                os.remove(file_path)

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Agent execution failed: {result.stderr}"
            )

        # Parse output
        try:
            output_data = json.loads(result.stdout.strip())
            if not output_data.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Agent execution failed: {output_data.get('error', 'Unknown error')}"
                )
        except json.JSONDecodeError:
            # If output is not JSON, return it as text
            output_data = {"outputs": {"result": result.stdout}}

        return {
            "success": True,
            "outputs": output_data.get("result", {}) if isinstance(output_data.get("result"), dict) else {"result": output_data.get("result")}
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Agent execution timeout (5 minutes)"
        )
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in run_agent: {e}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Agent run failed: {str(e)}"
        )
