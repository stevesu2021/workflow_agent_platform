"""
可研评审 - OpenManus + LangGraph Agent

Generated from: 可研评审Agentic智能体
"""

from typing import TypedDict, Annotated, Sequence, List, Dict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
import operator
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from .config import AgentConfig
except ImportError:
    from config import AgentConfig

try:
    from .nodes import *
except ImportError:
    try:
        from nodes import *
    except ImportError:
        pass  # Nodes will be defined inline if needed

try:
    from .tools import get_tools
except ImportError:
    try:
        from tools import get_tools
    except ImportError:
        def get_tools():
            return []


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    current_step: str
    context: dict
    results: dict
    user_input: str


class 可研评审Agent:
    """Main agent class using LangGraph."""

    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig()
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state graph."""
        # Create graph with state
        graph = StateGraph(AgentState)

        # Add nodes
        graph.add_node("step_1", step_1)
        graph.add_node("step_2", step_2)
        graph.add_node("step_3", step_3)
        graph.add_node("step_4", step_4)
        graph.add_node("step_5", step_5)
        graph.add_node("step_6", step_6)
        graph.add_node("step_7", step_7)

        # Set entry point
        graph.set_entry_point("step_1")

        # Add edges
        graph.add_edge("step_1", "step_2")
        graph.add_edge("step_2", "step_3")
        graph.add_edge("step_3", "step_4")
        graph.add_edge("step_4", "step_5")
        graph.add_edge("step_5", "step_6")
        graph.add_edge("step_6", "step_7")
        graph.add_edge("step_7", END)

        return graph.compile()

    def run(self, user_input: str) -> dict:
        """Run the agent with user input."""
        initial_state = {
            "messages": [HumanMessage(content=user_input)],
            "current_step": "start",
            "context": {},
            "results": {},
            "user_input": user_input
        }

        result = self.graph.invoke(initial_state)
        return result

    async def astream_run(self, user_input: str):
        """Async stream the agent execution."""
        initial_state = {
            "messages": [HumanMessage(content=user_input)],
            "current_step": "start",
            "context": {},
            "results": {},
            "user_input": user_input
        }

        async for event in self.graph.astream(initial_state):
            yield event


def create_agent(config: AgentConfig = None) -> 可研评审Agent:
    """Factory function to create the agent."""
    return 可研评审Agent(config)


if __name__ == "__main__":
    import asyncio

    async def main():
        agent = create_agent()
        result = await agent.astream_run("Hello, I need help with a task.")
        async for event in result:
            print(event)

    asyncio.run(main())
