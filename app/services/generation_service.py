from app.schemas.agent_schema import AgentGraph, Node, Edge, NodeData
import uuid

# Mock generation for now to avoid needing an API key immediately
# In production, this would call OpenAI/Anthropic
async def generate_agent_from_text(description: str) -> AgentGraph:
    # Simple keyword detection to make it feel somewhat dynamic
    nodes = []
    edges = []
    
    # Always have start
    nodes.append(Node(id="start", type="start", position={"x": 0, "y": 0}))
    
    current_last_node = "start"
    
    if "tool" in description.lower() or "search" in description.lower():
        nodes.append(Node(
            id="tool-node", 
            type="tool", 
            position={"x": 200, "y": 0},
            data=NodeData(label="Search Tool", tool_id="search_api")
        ))
        edges.append(Edge(id=str(uuid.uuid4()), source=current_last_node, target="tool-node"))
        current_last_node = "tool-node"
        
    if "summarize" in description.lower() or "generate" in description.lower() or "chat" in description.lower():
         nodes.append(Node(
            id="llm-node", 
            type="llm", 
            position={"x": 400, "y": 0},
            data=NodeData(label="LLM Processor", prompt="Process the input...")
        ))
         edges.append(Edge(id=str(uuid.uuid4()), source=current_last_node, target="llm-node"))
         current_last_node = "llm-node"
         
    # Always have end
    nodes.append(Node(id="end", type="end", position={"x": 600, "y": 0}))
    edges.append(Edge(id=str(uuid.uuid4()), source=current_last_node, target="end"))
    
    return AgentGraph(nodes=nodes, edges=edges)
