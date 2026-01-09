from typing import Dict, Optional

class ParameterConvertor:
    """
    Defines default parameter mappings between different node types in the workflow.
    Used to automatically configure target node inputs based on source node outputs.
    """
    
    # Registry mapping (SourceType, TargetType) -> { target_field: template_string }
    _MAPPINGS = {
        # Start Node Connections
        ("start", "llm"): {
            "prompt": "{{start_node.rawQuery}}"
        },
        ("start", "knowledge"): {
            "query": "{{start_node.rawQuery}}"
        },
        ("start", "intent_recognition"): {
            "query": "{{start_node.rawQuery}}"
        },
        ("start", "doc_parser"): {
            "file_path": "{{start_node.fileNames}}" # Assuming list or single file handling logic
        },
        ("start", "visual_understanding"): {
            "image_path": "{{start_node.fileNames}}"
        },
        ("start", "tool"): {
            "tool_input": "{{start_node.rawQuery}}"
        },

        # Knowledge Base Connections
        ("knowledge", "llm"): {
            "prompt": "Context:\n{{knowledge_node.chunks}}\n\nUser Question: {{start_node.rawQuery}}\n\nPlease answer the question based on the context above."
        },

        # LLM Connections
        ("llm", "tool"): {
            "tool_input": "{{llm_node.text}}" # Assuming LLM outputs JSON or text args
        },
        ("llm", "end"): {
            # End node usually doesn't need config, it just takes flow
            # but if we needed to map output:
            "final_result": "{{llm_node.text}}"
        },

        # Tool Connections
        ("tool", "llm"): {
            "prompt": "Tool Execution Result:\n{{tool_node.result}}\n\nPlease summarize or proceed based on this result."
        },

        # Document Parser Connections
        ("doc_parser", "llm"): {
            "prompt": "Document Content:\n{{doc_parser.content}}\n\nPlease analyze the document content above."
        },
        ("doc_parser", "knowledge"): {
            # Usually for indexing, might map content to payload
            "payload": "{{doc_parser.content}}"
        },

        # Visual Understanding Connections
        ("visual_understanding", "llm"): {
            "prompt": "Image Analysis:\n{{visual_understanding.description}}\n\nData:\n{{visual_understanding.data}}"
        },

        # Intent Recognition Connections
        ("intent_recognition", "llm"): {
            "prompt": "Detected Intent: {{intent_recognition.intent}}\nConfidence: {{intent_recognition.confidence}}\n\nUser Query: {{start_node.rawQuery}}"
        }
    }

    @classmethod
    def get_mapping(cls, source_type: str, target_type: str) -> Optional[Dict[str, str]]:
        """
        Retrieve the default mapping configuration for a specific edge.
        
        Args:
            source_type: The type of the source node (e.g., 'start', 'llm')
            target_type: The type of the target node (e.g., 'llm', 'tool')
            
        Returns:
            Dictionary containing target field names and their default template strings,
            or None if no default mapping exists.
        """
        return cls._MAPPINGS.get((source_type, target_type))

    @classmethod
    def get_all_mappings(cls) -> Dict[str, Dict[str, str]]:
        """
        Returns a string representation of all mappings (useful for frontend or debugging).
        Keys are 'source_type->target_type'.
        """
        return {f"{s}->{t}": m for (s, t), m in cls._MAPPINGS.items()}
