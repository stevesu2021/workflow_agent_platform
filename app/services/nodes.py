from typing import Dict, Any, Optional
import re
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from app.services.state import AgentState
from app.services.vector_service import vector_service
from app.services.ai_resource_service import AiResourceService
from app.core.database import get_session
from datetime import datetime
# Note: We need a way to access DB session inside node functions.
# Since nodes are stateless functions, we usually pass session in state or config.
# But LangGraph state is usually serializable data.
# Alternative: Use a context manager or dependency injection for services if possible.
# For now, let's try to get a new session or pass it via config if WorkflowEngine allows.
# But WorkflowEngine uses a fresh session for run_agent usually.
# Let's assume we can get a session or it's passed in 'context' of state?
# Currently 'context' in AgentState is Dict[str, Any]. We could put services there?
# But services are not serializable.

# Better approach:
# Create a helper to get AI resource config. 
# Since we are inside an async function, we can create a session.
from app.core.database import async_session_factory

async def get_llm_config(model_name: str):
    async with async_session_factory() as session:
        service = AiResourceService(session)
        # Try to find resource with this name
        resource = await service.get_resource_by_name(model_name, type_filter="text_llm")
        if resource:
            return {
                "api_key": resource.api_key,
                "base_url": resource.endpoint,
                "model": model_name # Or resource specific model name if stored in config
            }
        return None

# Helper to resolve variables like {{node_id.key}}
def resolve_variables(text: str, state: AgentState) -> str:
    if not text or not isinstance(text, str):
        return text
    
    node_outputs = state.get("node_outputs", {})
    
    def replace_match(match):
        # match group 1 is the content inside {{ }}
        var_path = match.group(1).strip()
        parts = var_path.split('.')
        
        # Handle {{start-node.input}} specifically if user input is stored directly
        # or handle general structure
        
        node_id = parts[0]
        
        # Check if node exists in outputs
        if node_id in node_outputs:
            current_data = node_outputs[node_id]
            
            # Navigate through parts
            if len(parts) > 1:
                keys = parts[1:]
                for key in keys:
                    if isinstance(current_data, dict):
                        current_data = current_data.get(key, "")
                        if current_data == "": # Key not found or empty
                             break
                    else:
                        current_data = ""
                        break
                
                val = current_data
                if isinstance(val, (dict, list)):
                    import json
                    return json.dumps(val, ensure_ascii=False)
                return str(val)
            else:
                if isinstance(current_data, (dict, list)):
                     import json
                     return json.dumps(current_data, ensure_ascii=False)
                return str(current_data)
        
        return match.group(0)

    return re.sub(r'\{\{(.*?)\}\}', replace_match, text)

# Helper to update state with node output
# We also append a trace log to 'trace_logs' key in state if available
def update_node_output(state: AgentState, node_id: str, output: Any, inputs: Optional[Dict[str, Any]] = None):
    outputs = state.get("node_outputs", {}).copy()
    outputs[node_id] = output
    
    # Trace log logic
    trace_logs = state.get("trace_logs", [])
    if trace_logs is None:
        trace_logs = []
        
    # Append new log
    # LangGraph state updates are merges, so we need to return the new list
    # Annotated[List, operator.add] means we should return a list to be appended
    # But here we are manually managing the list if we return the full list.
    # Wait, in state.py: trace_logs: Annotated[List[Dict[str, Any]], operator.add]
    # This means we should return a LIST of new items to be added.
    
    new_log = {
        "node_id": node_id,
        "inputs": inputs,
        "output": output,
        "timestamp": str(datetime.now())
    }
    
    return {"node_outputs": outputs, "current_node": node_id, "trace_logs": [new_log]}

async def llm_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing LLM Node {node_id} with config: {config}")
    
    # Resolve prompt (which usually serves as User Message)
    prompt_template = config.get('prompt') or ''
    resolved_prompt = resolve_variables(prompt_template, state)
    
    # If resolved prompt is empty, use a default to avoid errors
    if not resolved_prompt:
        resolved_prompt = "Hello"
    
    print(f"Resolved Prompt: {resolved_prompt}")
    
    # Get system prompt if available
    system_prompt = config.get('system_prompt') or "You are a helpful assistant."
    
    # Get temperature
    temperature = config.get('temperature', 0.7)
    
    # Call LLM
    model_name = config.get("model")
    
    if not model_name:
        # Try to find default resource from DB
        try:
            async with async_session_factory() as session:
                from app.models.ai_resource import AiResource
                from sqlmodel import select
                
                # Look for default text_llm
                stmt = select(AiResource).where(AiResource.type == "text_llm", AiResource.is_default == True)
                result = await session.execute(stmt)
                default_res = result.scalars().first()
                if default_res:
                    model_name = default_res.name
                    print(f"Using default system model: {model_name}")
        except Exception as e:
            print(f"Error fetching default model: {e}")

    if not model_name:
        model_name = "gpt-3.5-turbo"
    
    # Check if OPENAI_API_KEY is available. If not, use a mock response to prevent crash.
    import os
    
    # Try to get resource config from DB
    resource_config = await get_llm_config(model_name)
    
    api_key = None
    base_url = None
    
    if resource_config:
        print(f"Using AI Resource: {model_name}")
        api_key = resource_config.get("api_key")
        base_url = resource_config.get("base_url")
        
        # Sanitize base_url for ChatOpenAI which appends /chat/completions automatically
        if base_url and base_url.endswith("/chat/completions"):
            base_url = base_url.replace("/chat/completions", "")
            # Also strip trailing slash if present after replacement
            if base_url.endswith("/"):
                base_url = base_url.rstrip("/")
    else:
        # Fallback to env vars
        print(f"AI Resource {model_name} not found. Falling back to environment variables.")
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_API_BASE")

    if not api_key:
        print("OPENAI_API_KEY not found. Using Mock LLM response.")
        response_content = f"Mock LLM Response for prompt: {resolved_prompt[:50]}..."
        response = AIMessage(content=response_content)
        token_usage = {"total_tokens": 100}
        error_details = None
    else:
        try:
            # Note: ChatOpenAI uses openai_api_key and openai_api_base params
            llm = ChatOpenAI(
                model=model_name,
                openai_api_key=api_key,
                openai_api_base=base_url,
                temperature=temperature
            )
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=resolved_prompt)
            ]
            
            # Print detailed debug info before calling
            print(f"--- LLM REQUEST DEBUG ---")
            print(f"Node ID: {node_id}")
            print(f"Model: {model_name}")
            print(f"Base URL: {base_url}")
            print(f"Temperature: {temperature}")
            print(f"Messages: {messages}")
            print(f"-------------------------")
            
            response = await llm.ainvoke(messages)
            response_content = response.content
            token_usage = response.response_metadata.get("token_usage", {})
            error_details = None
        except Exception as e:
             import traceback
             error_trace = traceback.format_exc()
             print(f"LLM Call failed: {e}")
             print(f"Traceback: {error_trace}")
             
             # Fallback to mock on error
             response_content = f"LLM Error: {str(e)}. Mocking response."
             response = AIMessage(content=response_content)
             token_usage = {}
             error_details = {
                 "error_message": str(e),
                 "traceback": error_trace
             }
    
    # Store output
    # LLM output usually is 'text' or 'usage'
    output = {
        "text": response_content,
        "usage": token_usage
    }
    
    if error_details:
        output["error"] = error_details
    
    # Capture inputs for tracing
    inputs = {
        "model": model_name,
        "api_endpoint": base_url, # Add endpoint info
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": resolved_prompt
            }
        ],
        "temperature": temperature
    }
    
    # Update messages log
    return {
        **update_node_output(state, node_id, output, inputs=inputs),
        "messages": [response]
    }

async def tool_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing Tool Node {node_id}: {config}")
    
    # Resolve args
    tool_input = resolve_variables(config.get('tool_input', ''), state)
    
    # Execute tool logic here
    result = f"Tool {config.get('tool_id')} execution result with input: {tool_input}"
    
    output = {"result": result}
    
    return update_node_output(state, node_id, output)

async def knowledge_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing Knowledge Node {node_id}: {config}")
    
    query = resolve_variables(config.get('query', ''), state)
    # Default to start node rawQuery if not specified? 
    # Better to rely on explicit config.
    
    kb_id = config.get('knowledge_id')
    if kb_id:
        # Search in vector store
        # We use the kb_id as collection name (or map it)
        # Assuming kb_id is the collection name for simplicity
        results = await vector_service.search(kb_id, query)
        chunks = [
            {"content": doc.page_content, "score": score, "metadata": doc.metadata} 
            for doc, score in results
        ]
    else:
        chunks = []
        
    output = {"chunks": chunks}
    return update_node_output(state, node_id, output)

async def start_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing Start Node {node_id}")
    # Start node output is usually the initial user inputs
    
    # Let's grab from context
    initial_inputs = state.get("context", {})
    
    # Format output according to requested schema
    output = {
        "rawQuery": initial_inputs.get("input", ""),
        "fileNames": [initial_inputs.get("file_name")] if initial_inputs.get("file_name") else [],
        "fileUrls": [], # To be implemented if upload logic exists
        "request_id": initial_inputs.get("request_id", ""),
        "conversion_id": initial_inputs.get("conversion_id", "")
    }
    
    return update_node_output(state, node_id, output)

async def end_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing End Node {node_id}")
    # End node might aggregate outputs?
    return {"current_node": node_id}

# Registry mapping node types to functions
NODE_REGISTRY = {
    "llm": llm_node,
    "tool": tool_node,
    "knowledge": knowledge_node,
    "start": start_node,
    "end": end_node,
    "common": llm_node # Fallback
}
