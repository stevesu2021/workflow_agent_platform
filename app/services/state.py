from typing import Dict, Any, List, Annotated
import operator
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    context: Dict[str, Any]
    node_outputs: Dict[str, Any]
    current_node: str
    trace_logs: Annotated[List[Dict[str, Any]], operator.add]
