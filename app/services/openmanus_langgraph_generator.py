"""
Service for generating OpenManus + LangGraph implementation code
based on agent requirements decomposition.
"""
import os
import re
from typing import Dict, Any, List, Optional
from pathlib import Path
import json


class OpenManusLangGraphGenerator:
    """Generator for OpenManus + LangGraph agent implementation."""

    def __init__(self, openmanus_path: str = None):
        """
        Initialize the generator.

        Args:
            openmanus_path: Path to OpenManus installation directory
        """
        self.openmanus_path = openmanus_path or os.getenv("OPENMANUS_PATH", "./OpenManus")
        self.workspace_base = os.path.join(self.openmanus_path, "workspace")

    def generate_agent_code(
        self,
        agent_name: str,
        agent_description: str,
        decomposition_doc: str,
        config: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate OpenManus + LangGraph implementation code.

        Args:
            agent_name: Name of the agent
            agent_description: Description of the agent
            decomposition_doc: Decomposition document content
            config: Agent configuration including models, tools, knowledge bases

        Returns:
            Dict with file paths as keys and file content as values
        """
        # Parse decomposition document
        parsed_info = self._parse_decomposition(decomposition_doc, config)

        # Create workspace directory
        workspace_dir = os.path.join(self.workspace_base, self._sanitize_name(agent_name))
        os.makedirs(workspace_dir, exist_ok=True)

        # Generate files
        files = {}

        # 1. Main agent file with LangGraph
        files["agent.py"] = self._generate_main_agent(
            agent_name, agent_description, parsed_info, config
        )

        # 2. Configuration file
        files["config.py"] = self._generate_config(agent_name, config)

        # 3. Nodes implementation
        files["nodes.py"] = self._generate_nodes(parsed_info, config)

        # 4. Tools implementation
        if parsed_info.get("tools"):
            files["tools.py"] = self._generate_tools(parsed_info, config)

        # 5. Graph visualization
        files["graph.json"] = self._generate_graph_json(parsed_info)

        # 6. Requirements file
        files["requirements.txt"] = self._generate_requirements(config)

        # 7. Environment file (.env)
        files[".env"] = self._generate_env_file(agent_name, config)

        # 8. README
        files["README.md"] = self._generate_readme(agent_name, agent_description, parsed_info)

        return files

    def _parse_decomposition(
        self,
        decomposition_doc: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Parse the decomposition document to extract structured information.
        """
        parsed = {
            "agent_name": "",
            "description": "",
            "task_steps": [],
            "nodes": [],
            "edges": [],
            "tools": [],
            "knowledge_bases": [],
            "inputs": [],
            "outputs": [],
            "models": {}
        }

        # Extract task steps
        task_pattern = r'(?:步骤|Step)\s*(\d+)[:\s]+(.*?)(?=(?:步骤|Step)|\Z|#{2,})'
        steps = re.findall(task_pattern, decomposition_doc, re.IGNORECASE | re.DOTALL)
        for step_num, step_desc in steps:
            parsed["task_steps"].append({
                "order": int(step_num),
                "description": step_desc.strip()
            })

        # Extract nodes (LangGraph nodes)
        node_pattern = r'(?:节点|Node)[\s\:：]+([A-Za-z_][A-Za-z0-9_]*)[:\s]+(.*?)(?=(?:节点|Node)|\Z|#{2,}|(?:边|Edge))'
        nodes = re.findall(node_pattern, decomposition_doc, re.IGNORECASE | re.DOTALL)
        for node_name, node_desc in nodes:
            parsed["nodes"].append({
                "name": node_name,
                "description": node_desc.strip()
            })

        # Extract edges (transitions)
        edge_pattern = r'(?:边|Edge|Transition)[\s\:：]+([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)'
        edges = re.findall(edge_pattern, decomposition_doc, re.IGNORECASE)
        for from_node, to_node in edges:
            parsed["edges"].append({
                "from": from_node,
                "to": to_node
            })

        # Extract tools
        tool_keywords = ["工具", "Tool", "MCP", "API"]
        for keyword in tool_keywords:
            pattern = rf'{keyword}[\s\:：]+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)'
            tools = re.findall(pattern, decomposition_doc, re.IGNORECASE)
            for tool_list in tools:
                for tool in tool_list.split(','):
                    tool = tool.strip()
                    if tool and tool not in parsed["tools"]:
                        parsed["tools"].append(tool)

        # Extract from config
        if config.get("tools"):
            parsed["tools"].extend(config["tools"])
        if config.get("knowledge_bases"):
            parsed["knowledge_bases"] = config["knowledge_bases"]
        if config.get("io_config"):
            parsed["inputs"] = config["io_config"].get("inputs", [])
            parsed["outputs"] = config["io_config"].get("outputs", [])

        # Model configuration
        parsed["models"] = {
            "thinking": config.get("model_thinking", "gpt-4"),
            "summary": config.get("model_summary", "gpt-3.5-turbo")
        }

        # Generate nodes from task steps if no explicit nodes
        if not parsed["nodes"] and parsed["task_steps"]:
            for i, step in enumerate(parsed["task_steps"]):
                parsed["nodes"].append({
                    "name": f"step_{i+1}",
                    "description": step["description"]
                })

        # Generate edges from nodes
        if not parsed["edges"] and len(parsed["nodes"]) > 1:
            for i in range(len(parsed["nodes"]) - 1):
                parsed["edges"].append({
                    "from": parsed["nodes"][i]["name"],
                    "to": parsed["nodes"][i+1]["name"]
                })

        return parsed

    def _generate_main_agent(
        self,
        agent_name: str,
        agent_description: str,
        parsed_info: Dict[str, Any],
        config: Dict[str, Any]
    ) -> str:
        """Generate the main agent file with LangGraph."""
        sanitized_name = self._sanitize_name(agent_name)
        nodes_code = []
        edges_code = []

        # Helper function to escape and truncate descriptions
        def escape_desc(desc: str) -> str:
            # Remove newlines and limit length
            desc = desc.replace('\n', ' ').replace('\r', ' ').replace('"', "'")
            # Truncate to reasonable length
            if len(desc) > 100:
                desc = desc[:97] + "..."
            return desc

        # Generate node definitions - register node functions directly
        for node in parsed_info.get("nodes", []):
            safe_name = node["name"].replace("-", "_")
            # Use 8 spaces for proper indentation inside _build_graph method
            nodes_code.append(f'        graph.add_node("{node["name"]}", {safe_name})')

        # Generate edge definitions
        for edge in parsed_info.get("edges", []):
            # Use 8 spaces for proper indentation inside _build_graph method
            edges_code.append(f'        graph.add_edge("{edge["from"]}", "{edge["to"]}")')

        # Get entry point
        entry_point = parsed_info.get("nodes", [{"name": "start"}])[0].get("name", "start")

        # Get last node for END edge
        last_node = parsed_info.get("nodes", [{"name": "start"}])[-1].get("name", "start")
        if last_node != "END":
            edges_code.append(f'        graph.add_edge("{last_node}", END)')

        code = f'''"""
{agent_name} - OpenManus + LangGraph Agent

Generated from: {agent_description}
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


class {self._to_class_name(sanitized_name)}Agent:
    """Main agent class using LangGraph."""

    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig()
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state graph."""
        # Create graph with state
        graph = StateGraph(AgentState)

        # Add nodes
{chr(10).join(nodes_code) if nodes_code else '    # Add your nodes here'}

        # Set entry point
        graph.set_entry_point("{entry_point}")

        # Add edges
{chr(10).join(edges_code) if edges_code else '    # Add your edges here'}

        return graph.compile()

    def run(self, user_input: str) -> dict:
        """Run the agent with user input."""
        initial_state = {{
            "messages": [HumanMessage(content=user_input)],
            "current_step": "start",
            "context": {{}},
            "results": {{}},
            "user_input": user_input
        }}

        result = self.graph.invoke(initial_state)
        return result

    async def astream_run(self, user_input: str):
        """Async stream the agent execution."""
        initial_state = {{
            "messages": [HumanMessage(content=user_input)],
            "current_step": "start",
            "context": {{}},
            "results": {{}},
            "user_input": user_input
        }}

        async for event in self.graph.astream(initial_state):
            yield event


def create_agent(config: AgentConfig = None) -> {self._to_class_name(sanitized_name)}Agent:
    """Factory function to create the agent."""
    return {self._to_class_name(sanitized_name)}Agent(config)


if __name__ == "__main__":
    import asyncio

    async def main():
        agent = create_agent()
        result = await agent.astream_run("Hello, I need help with a task.")
        async for event in result:
            print(event)

    asyncio.run(main())
'''
        return code

    def _generate_config(
        self,
        agent_name: str,
        config: Dict[str, Any]
    ) -> str:
        """Generate configuration file."""
        sanitized_name = self._to_class_name(agent_name)
        thinking_model = config.get("model_thinking", "gpt-4")
        summary_model = config.get("model_summary", "gpt-3.5-turbo")

        code = f'''"""
Configuration for {agent_name} Agent
"""

from dataclasses import dataclass
from typing import Optional
import os
from pathlib import Path

# Load .env file from the same directory as this file
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)


@dataclass
class LLMConfig:
    """LLM configuration."""
    model: str = os.getenv("LLM_MODEL", "{thinking_model}")
    base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    api_key: str = os.getenv("LLM_API_KEY", "")
    temperature: float = 0.7
    max_tokens: int = 4096


@dataclass
class KnowledgeBaseConfig:
    """Knowledge base configuration."""
    enabled: bool = {len(config.get("knowledge_bases", [])) > 0}
    base_url: str = os.getenv("KB_BASE_URL", "http://localhost:8001")
    knowledge_bases: list = None

    def __post_init__(self):
        if self.knowledge_bases is None:
            self.knowledge_bases = {config.get("knowledge_bases", [])}


@dataclass
class {self._to_class_name(sanitized_name)}Config:
    """Main configuration for {agent_name} agent."""
    llm: LLMConfig = None
    knowledge_base: KnowledgeBaseConfig = None
    max_thoughts: int = {config.get("max_thoughts", 5)}
    tools: list = None

    def __post_init__(self):
        if self.llm is None:
            self.llm = LLMConfig()
        if self.knowledge_base is None:
            self.knowledge_base = KnowledgeBaseConfig()
        if self.tools is None:
            self.tools = {config.get("tools", [])}


# Global config instance
config = {self._to_class_name(sanitized_name)}Config()

# Alias for backward compatibility
AgentConfig = {self._to_class_name(sanitized_name)}Config
'''
        return code

    def _generate_nodes(
        self,
        parsed_info: Dict[str, Any],
        config: Dict[str, Any]
    ) -> str:
        """Generate nodes implementation file."""
        nodes_code = []

        for i, node in enumerate(parsed_info.get("nodes", [])):
            node_code = f'''
def {node["name"]}(state: AgentState) -> dict:
    """
    Node: {node["name"]}

    {node["description"]}
    """
    # Get LLM
    try:
        from .config import config
    except ImportError:
        from config import config

    # Use base_url for newer langchain-openai versions (0.2.0+)
    # The base_url should include /chat/completions
    llm = ChatOpenAI(
        model=config.llm.model,
        base_url=config.llm.base_url,
        api_key=config.llm.api_key,
        temperature=config.llm.temperature
    )

    # Process with LLM
    messages = state["messages"]
    response = llm.invoke(messages)

    return {{
        "messages": [response],
        "current_step": "{node["name"]}",
        "results": {{
            **state.get("results", {{}}),
            "{node["name"]}": response.content
        }}
    }}
'''
            nodes_code.append(node_code)

        if not nodes_code:
            nodes_code.append('''
def start(state: AgentState) -> dict:
    """Start node - initialize the agent."""
    return {
        "messages": state["messages"],
        "current_step": "start",
        "context": {},
        "results": {}
    }
''')

        code = f'''"""
Agent Nodes Implementation

Each node represents a step in the LangGraph workflow.
"""

from typing import Dict, Any, TypedDict, Annotated, Sequence
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage
import operator

# Try to import AgentState from agent module, otherwise define it locally
try:
    from .agent import AgentState
except ImportError:
    try:
        from agent import AgentState
    except ImportError:
        # Define AgentState locally if import fails
        class AgentState(TypedDict):
            """State for the agent graph."""
            messages: Annotated[Sequence[BaseMessage], operator.add]
            current_step: str
            context: dict
            results: dict
            user_input: str


class AgentNode:
    """Base class for agent nodes."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the node logic."""
        raise NotImplementedError("Subclasses must implement __call__")


# Node implementations
{chr(10).join(nodes_code) if nodes_code else "# Add your node implementations here"}
'''
        return code

    def _generate_tools(
        self,
        parsed_info: Dict[str, Any],
        config: Dict[str, Any]
    ) -> str:
        """Generate tools implementation file."""
        tools_code = []

        for tool_name in parsed_info.get("tools", []):
            tool_code = f'''
class {tool_name}(BaseTool):
    """Tool: {tool_name}"""

    name = "{tool_name.lower()}"
    description = "Execute {tool_name} operation"

    def _run(self, query: str) -> str:
        """Run the tool."""
        # Implement your tool logic here
        return f"Executed {tool_name} with query: {{query}}"

    async def _arun(self, query: str) -> str:
        """Async run the tool."""
        return self._run(query)
'''
            tools_code.append(tool_code)

        code = f'''"""
Agent Tools Implementation

Tools that can be used by the agent during execution.
"""

from langchain.tools import BaseTool
from typing import Optional


def get_tools() -> list:
    """Get list of available tools."""
    tools = []
{chr(10).join([f"    tools.append({tool_name}())" for tool_name in parsed_info.get("tools", [])]) if parsed_info.get("tools") else "    # Add your tools here"}
    return tools


# Tool implementations
{chr(10).join(tools_code) if tools_code else "# Add your tool implementations here"}
'''
        return code

    def _generate_graph_json(self, parsed_info: Dict[str, Any]) -> str:
        """Generate graph JSON for visualization."""
        graph_data = {
            "nodes": [
                {
                    "id": node["name"],
                    "label": node["name"],
                    "description": node["description"]
                }
                for node in parsed_info.get("nodes", [])
            ],
            "edges": [
                {
                    "from": edge["from"],
                    "to": edge["to"]
                }
                for edge in parsed_info.get("edges", [])
            ]
        }
        return json.dumps(graph_data, indent=2, ensure_ascii=False)

    def _generate_requirements(self, config: Dict[str, Any]) -> str:
        """Generate requirements.txt file."""
        return '''langchain>=1.0
langchain-openai>=0.2.0
langgraph>=1.0
langchain-core>=1.0
pydantic>=2.0.0
httpx[socks]>=0.24.0
aiohttp>=3.8.0
python-dotenv>=1.0.0
'''

    def _generate_env_file(self, agent_name: str, config: Dict[str, Any]) -> str:
        """Generate .env file with environment variables."""
        lines = []
        lines.append(f"# {agent_name} - Environment Configuration")
        lines.append(f"# Generated at: {self._get_current_time()}")
        lines.append("")
        lines.append("# LLM Configuration")
        lines.append("# Thinking Model (for complex reasoning)")

        # Ensure base_url includes /chat/completions for langchain-openai
        thinking_base_url = config.get('llm_thinking_base_url', '')
        if thinking_base_url and not thinking_base_url.endswith('/chat/completions'):
            thinking_base_url = thinking_base_url.rstrip('/') + '/chat/completions'

        lines.append(f"LLM_API_KEY={config.get('llm_thinking_api_key', '')}")
        lines.append(f"LLM_BASE_URL={thinking_base_url}")
        lines.append(f"LLM_MODEL={config.get('model_thinking', '')}")
        lines.append("")

        # Summary Model
        lines.append("# Summary Model (for quick tasks)")
        summary_base_url = config.get('llm_summary_base_url', '')
        if summary_base_url and not summary_base_url.endswith('/chat/completions'):
            summary_base_url = summary_base_url.rstrip('/') + '/chat/completions'

        lines.append(f"LLM_SUMMARY_API_KEY={config.get('llm_summary_api_key', '')}")
        lines.append(f"LLM_SUMMARY_BASE_URL={summary_base_url}")
        lines.append(f"LLM_SUMMARY_MODEL={config.get('model_summary', '')}")
        lines.append("")

        # Knowledge Base configuration
        if config.get("knowledge_bases"):
            lines.append("# Knowledge Base Configuration")
            lines.append("KB_BASE_URL=http://localhost:8001")
            lines.append(f"KNOWLEDGE_BASES={','.join(config['knowledge_bases'])}")
            lines.append("")

        # Tool configuration
        if config.get("tools"):
            lines.append("# Tool Configuration")
            lines.append(f"TOOLS={','.join(config['tools'])}")
            lines.append("")

        # Additional environment variables
        lines.append("# Additional Configuration")
        lines.append("MAX_THOUGHTS=" + str(config.get("max_thoughts", 5)))
        lines.append("")

        lines.append("# MinIO Configuration (if using object storage)")
        lines.append("MINIO_ENDPOINT=localhost:9000")
        lines.append("MINIO_ACCESS_KEY=minioadmin")
        lines.append("MINIO_SECRET_KEY=minioadmin")
        lines.append("")

        lines.append("# Milvus Configuration (if using vector database)")
        lines.append("MILVUS_HOST=localhost")
        lines.append("MILVUS_PORT=19530")
        lines.append("")

        return '\n'.join(lines)

    def _get_current_time(self) -> str:
        """Get current timestamp as string."""
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def _generate_readme(
        self,
        agent_name: str,
        agent_description: str,
        parsed_info: Dict[str, Any]
    ) -> str:
        """Generate README.md file."""
        nodes_list = "\n".join([f"- {n['name']}: {n['description']}" for n in parsed_info.get("nodes", [])])
        edges_list = "\n".join([f"- {e['from']} → {e['to']}" for e in parsed_info.get("edges", [])])

        return f'''# {agent_name}

## Description

{agent_description}

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set up environment variables:

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.openai.com/v1"
```

## Usage

```python
from agent import create_agent

# Create agent instance
agent = create_agent()

# Run synchronously
result = agent.run("Your input here")
print(result)

# Or stream asynchronously
import asyncio

async def main():
    async for event in agent.astream_run("Your input here"):
        print(event)

asyncio.run(main())
```

## LangGraph Structure

### Nodes

{nodes_list if nodes_list else "- No nodes defined"}

### Edges (Transitions)

{edges_list if edges_list else "- No edges defined"}

## Tools Used

{chr(10).join([f"- {tool}" for tool in parsed_info.get("tools", [])]) if parsed_info.get("tools") else "- No tools defined"}

## Knowledge Bases

{chr(10).join([f"- {kb}" for kb in parsed_info.get("knowledge_bases", [])]) if parsed_info.get("knowledge_bases") else "- No knowledge bases defined"}

## License

MIT License
'''

    def _sanitize_name(self, name: str) -> str:
        """Sanitize agent name for file/directory usage."""
        # Remove special characters, replace spaces with underscores
        sanitized = re.sub(r'[^\w\s-]', '', name)
        sanitized = re.sub(r'[-\s]+', '_', sanitized)
        return sanitized.strip('_')

    def _to_class_name(self, name: str) -> str:
        """Convert name to class name format."""
        sanitized = self._sanitize_name(name)
        # Convert to PascalCase
        return ''.join(word.capitalize() for word in sanitized.split('_'))


# Singleton instance
_generator = None


def get_generator() -> OpenManusLangGraphGenerator:
    """Get or create the generator instance."""
    global _generator
    if _generator is None:
        _generator = OpenManusLangGraphGenerator()
    return _generator
