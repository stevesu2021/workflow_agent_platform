from langgraph.graph import StateGraph, END
from app.schemas.agent_schema import AgentGraph
from app.services.state import AgentState
from app.services.nodes import NODE_REGISTRY
from functools import partial

class WorkflowBuilder:
    def __init__(self, graph_def: AgentGraph):
        self.graph_def = graph_def
        self.workflow = StateGraph(AgentState)
    
    def build(self):
        # 1. Add Nodes
        for node in self.graph_def.nodes:
            if node.type in NODE_REGISTRY:
                # Partial application to inject config
                node_func = partial(NODE_REGISTRY[node.type], config=node.data.model_dump())
                self.workflow.add_node(node.id, node_func)
            elif node.type == 'input':
                 self.workflow.add_node(node.id, partial(NODE_REGISTRY['start'], config=node.data.model_dump()))
            elif node.type == 'output':
                 self.workflow.add_node(node.id, partial(NODE_REGISTRY['end'], config=node.data.model_dump()))
            else:
                # Fallback for unknown nodes
                print(f"Warning: Unknown node type {node.type}")
                pass

        # 2. Add Edges
        # We need to find the entry point. Convention: Node with type 'start' or 'input'
        start_node_id = None
        for node in self.graph_def.nodes:
            if node.type in ['start', 'input']:
                start_node_id = node.id
                break
        
        if start_node_id:
            self.workflow.set_entry_point(start_node_id)
        
        for edge in self.graph_def.edges:
            # Simple edge
            if not edge.condition:
                self.workflow.add_edge(edge.source, edge.target)
            else:
                # Conditional edge logic would go here
                # self.workflow.add_conditional_edges(...)
                pass
        
        return self.workflow.compile()
