from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.services.agent_service import AgentService
from app.services.workflow_engine import WorkflowBuilder
from app.schemas.agent_schema import AgentGraph
from langchain_core.messages import HumanMessage
import uuid
from typing import Dict, Any

router = APIRouter()

@router.post("/{agent_id}/run")
async def run_agent(
    agent_id: uuid.UUID, 
    inputs: Dict[str, Any],
    session: AsyncSession = Depends(get_session)
):
    service = AgentService(session)
    
    # 1. Get Agent Version
    version = await service.get_latest_version(agent_id)
    if not version:
        raise HTTPException(status_code=404, detail="Agent version not found")
    
    # 2. Reconstruct Graph Definition
    # Note: stored as dict, need to parse back to Pydantic
    try:
        graph_def = AgentGraph(**version.flow_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid graph definition: {str(e)}")
    
    # 3. Build Runnable
    builder = WorkflowBuilder(graph_def)
    app = builder.build()
    
    # 4. Execute
    # Convert input string to message if needed
    user_input = inputs.get("input", "")
    initial_state = {
        "messages": [HumanMessage(content=user_input)],
        "context": inputs
    }
    
    try:
        result = await app.ainvoke(initial_state)
        # Extract last message
        last_message = result["messages"][-1].content
        return {"status": "success", "output": last_message, "full_state": str(result)}
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")
