from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.services.agent_service import AgentService
from app.services.workflow_engine import WorkflowBuilder
from app.schemas.agent_schema import AgentGraph
from langchain_core.messages import HumanMessage
import uuid
from typing import Dict, Any

from pydantic import BaseModel

class AgentRunRequest(BaseModel):
    inputs: Dict[str, Any]

router = APIRouter()

@router.post("/{agent_id}/run")
async def run_agent(
    agent_id: uuid.UUID, 
    request: AgentRunRequest,
    session: AsyncSession = Depends(get_session)
):
    inputs = request.inputs
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
    
    # Generate IDs if not present
    if "request_id" not in inputs:
        inputs["request_id"] = str(uuid.uuid4())
    if "conversion_id" not in inputs:
        inputs["conversion_id"] = str(uuid.uuid4())
        
    # Initialize node_outputs with start node inputs if possible, 
    # but strictly start_node function logic handles input mapping.
    # We pass inputs via 'context' so start_node can pick them up.
    
    initial_state = {
        "messages": [HumanMessage(content=user_input)],
        "context": inputs,
        "node_outputs": {},
        "trace_logs": []
    }
    
    try:
        result = await app.ainvoke(initial_state)
        # Extract last message or some result
        # The result state contains messages log.
        # We can also check node_outputs of the 'end' node or just return the chat response.
        
        last_message = ""
        if result["messages"]:
            last_message = result["messages"][-1].content
            
        return {
            "status": "success", 
            "output": last_message, 
            "full_state": str(result),
            "trace_logs": result.get("trace_logs", [])
        }
    except Exception as e:
         import traceback
         traceback.print_exc()
         raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")
