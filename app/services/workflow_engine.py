from langgraph.graph import StateGraph, END
from app.schemas.agent_schema import AgentGraph
from app.services.state import AgentState
from app.services.nodes import NODE_REGISTRY
from app.services.parameter_convertor import ParameterConvertor
from functools import partial

class WorkflowBuilder:
    def __init__(self, graph_def: AgentGraph):
        self.graph_def = graph_def
        self.workflow = StateGraph(AgentState)
    
    def build(self):
        # Index nodes and edges for parameter mapping
        node_map = {node.id: node for node in self.graph_def.nodes}
        incoming_edges = {}
        for edge in self.graph_def.edges:
            if edge.target not in incoming_edges:
                incoming_edges[edge.target] = []
            incoming_edges[edge.target].append(edge)
            
        # Find start node for global template replacement
        start_node_id = None
        for node in self.graph_def.nodes:
            if node.type in ['start', 'input']:
                start_node_id = node.id
                break

        # 1. Add Nodes
        for node in self.graph_def.nodes:
            n_config = node.data.model_dump()
            
            # --- Apply ParameterConvertor Logic ---
            # Map default connection parameters if config is missing
            node_edges = incoming_edges.get(node.id, [])
            for edge in node_edges:
                source_node = node_map.get(edge.source)
                if not source_node:
                    continue
                
                # Normalize types for Convertor (input->start)
                source_type = 'start' if source_node.type == 'input' else source_node.type
                target_type = 'start' if node.type == 'input' else node.type
                
                mapping = ParameterConvertor.get_mapping(source_type, target_type)
                if mapping:
                    for field, template in mapping.items():
                        # Only apply if configuration is missing, empty, or looks like a default/copy error
                        current_val = n_config.get(field)
                        
                        # Check if invalid: empty, or for prompt/query, if it matches system_prompt (copy paste error)
                        is_invalid = not current_val
                        if not is_invalid and field in ['prompt', 'query'] and n_config.get('system_prompt'):
                            if current_val == n_config.get('system_prompt'):
                                is_invalid = True
                        
                        if is_invalid:
                            # Determine alias for source node (e.g. start -> start_node)
                            alias_map = {
                                'start': 'start_node',
                                'knowledge': 'knowledge_node', 
                                'llm': 'llm_node',
                                'tool': 'tool_node'
                            }
                            alias = alias_map.get(source_type, source_type)
                            
                            # Replace alias with actual source node ID
                            # e.g. {{start_node.rawQuery}} -> {{uuid.rawQuery}}
                            resolved_template = template.replace(f"{{{{{alias}.", f"{{{{{source_node.id}.")
                            n_config[field] = resolved_template
            
            # --- Global Template Replacement ---
            # Replace {{start_node.xxx}} with {{actual_start_id.xxx}} if it remains
            if start_node_id:
                for k, v in n_config.items():
                    if isinstance(v, str) and "{{start_node." in v:
                        n_config[k] = v.replace("{{start_node.", f"{{{{{start_node_id}.")

            # Helper wrapper to isolate signature
            def create_node_wrapper(n_type, n_config, n_id):
                async def node_wrapper(state):
                    return await NODE_REGISTRY[n_type](state, n_config, n_id)
                return node_wrapper

            if node.type in NODE_REGISTRY:
                node_func = create_node_wrapper(node.type, n_config, node.id)
                self.workflow.add_node(node.id, node_func)
            elif node.type == 'input':
                 node_func = create_node_wrapper('start', n_config, node.id)
                 self.workflow.add_node(node.id, node_func)
            elif node.type == 'output':
                 node_func = create_node_wrapper('end', n_config, node.id)
                 self.workflow.add_node(node.id, node_func)
            else:
                # Fallback for unknown nodes - use common/llm with warning or skip
                print(f"Warning: Unknown node type {node.type}, using common/llm fallback")
                node_func = create_node_wrapper('common', n_config, node.id)
                self.workflow.add_node(node.id, node_func)

        
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
