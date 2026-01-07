from typing import Dict, Any
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from app.services.state import AgentState

# Mock LLM for now, or real if key provided
async def llm_node(state: AgentState, config: Dict[str, Any]):
    print(f"Executing LLM Node with config: {config}")
    # In a real scenario, we'd use config['model'], config['prompt']
    # model_name = config.get('model', 'gpt-3.5-turbo')
    # llm = ChatOpenAI(model=model_name)
    # response = await llm.ainvoke(state['messages'])
    
    # Mock response
    response = AIMessage(content=f"Processed by LLM with config: {config.get('prompt', 'default')}")
    return {"messages": [response], "current_node": "llm"}

async def tool_node(state: AgentState, config: Dict[str, Any]):
    print(f"Executing Tool Node: {config}")
    # Execute tool logic here
    result = f"Tool {config.get('tool_id')} execution result"
    return {"context": {"tool_result": result}, "current_node": "tool"}

async def start_node(state: AgentState, config: Dict[str, Any]):
    print("Workflow Started")
    return {"current_node": "start"}

async def end_node(state: AgentState, config: Dict[str, Any]):
    print("Workflow Ended")
    return {"current_node": "end"}

# Registry mapping node types to functions
NODE_REGISTRY = {
    "llm": llm_node,
    "tool": tool_node,
    "start": start_node,
    "end": end_node
}
