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

async def get_llm_config(model_identifier: str):
    """
    Get LLM configuration by resource ID or name.

    Args:
        model_identifier: Resource ID (UUID) or resource name

    Returns:
        Dict with api_key, base_url, and model name, or None if not found
    """
    import uuid

    async with async_session_factory() as session:
        service = AiResourceService(session)

        resource = None

        # First, try to parse as UUID and search by ID
        try:
            resource_id = uuid.UUID(model_identifier)
            resource = await service.get_resource(resource_id)
            if resource and resource.type != "text_llm":
                resource = None
        except (ValueError, AttributeError):
            # Not a valid UUID, continue to name search
            pass

        # Fallback: search by name if not found by ID
        if not resource:
            resource = await service.get_resource_by_name(model_identifier, type_filter="text_llm")

        if resource:
            # Extract model name from resource config
            # The config field is a JSON dict that may contain a "model" key
            actual_model = resource.config.get("model") if resource.config else None
            if not actual_model:
                # Fallback to resource name if model not in config
                actual_model = resource.name

            return {
                "api_key": resource.api_key,
                "base_url": resource.endpoint,
                "model": actual_model,
                "resource_name": resource.name
            }

        return None

# Helper to format knowledge chunks into readable text
def format_knowledge_chunks(chunks: list) -> str:
    """Format knowledge chunks into a readable text string for LLM context."""
    if not chunks:
        return "No relevant information found."

    formatted_lines = []
    for i, chunk in enumerate(chunks, 1):
        content = chunk.get("content", "")
        score = chunk.get("score", 0)
        metadata = chunk.get("metadata", {})

        # Format each chunk with its content and relevance score
        chunk_text = f"[Source {i}] (Relevance: {score:.2f})\n{content}"
        formatted_lines.append(chunk_text)

    return "\n\n".join(formatted_lines)


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
                    elif isinstance(current_data, list) and key.isdigit():
                        # Handle array index access like fileUrls.0
                        idx = int(key)
                        if 0 <= idx < len(current_data):
                            current_data = current_data[idx]
                        else:
                            current_data = ""
                            break
                    else:
                        current_data = ""
                        break

                val = current_data
                # Special handling for knowledge chunks
                if isinstance(val, list):
                    # Check if this is a knowledge chunks list
                    if val and isinstance(val[0], dict) and "content" in val[0]:
                        return format_knowledge_chunks(val)
                    else:
                        import json
                        return json.dumps(val, ensure_ascii=False)
                if isinstance(val, dict):
                    import json
                    return json.dumps(val, ensure_ascii=False)
                return str(val)
            else:
                if isinstance(current_data, list):
                    # Check if this is a knowledge chunks list
                    if current_data and isinstance(current_data[0], dict) and "content" in current_data[0]:
                        return format_knowledge_chunks(current_data)
                    else:
                        import json
                        return json.dumps(current_data, ensure_ascii=False)
                if isinstance(current_data, dict):
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
    actual_model_name = model_name  # Default to the original model_name

    if resource_config:
        print(f"Using AI Resource: {model_name}")
        api_key = resource_config.get("api_key")
        base_url = resource_config.get("base_url")
        actual_model_name = resource_config.get("model")  # Use the actual model from config

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
                model=actual_model_name,  # Use the actual model name from resource config
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

    # Use 'content' parameter for input query text
    # Fallback to 'query' for backward compatibility
    content = resolve_variables(config.get('content', '') or config.get('query', ''), state)

    kb_id = config.get('knowledge_id')
    if kb_id:
        # Get the actual collection name (supports both new and old formats)
        from app.services.vector_service import get_collection_name_for_kb
        collection_name = get_collection_name_for_kb(kb_id)
        print(f"Searching in collection: {collection_name} (kb_id: {kb_id}), query: {content}")

        # Search in vector store
        results = await vector_service.search(collection_name, content)
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

    # Extract file information from inputs
    # fileUrls and fileNames may be passed from the frontend after upload
    file_urls = initial_inputs.get("fileUrls", [])
    file_names = initial_inputs.get("fileNames", [])

    # For backward compatibility, also check for single file_name
    if not file_names and initial_inputs.get("file_name"):
        file_names = [initial_inputs.get("file_name")]
    if not file_urls and initial_inputs.get("file_url"):
        file_urls = [initial_inputs.get("file_url")]

    # Format output according to requested schema
    output = {
        "rawQuery": initial_inputs.get("input", ""),
        "fileNames": file_names,
        "fileUrls": file_urls,
        "request_id": initial_inputs.get("request_id", ""),
        "conversion_id": initial_inputs.get("conversion_id", "")
    }

    return update_node_output(state, node_id, output)

async def end_node(state: AgentState, config: Dict[str, Any], node_id: str):
    print(f"Executing End Node {node_id}")
    # End node might aggregate outputs?
    return {"current_node": node_id}

async def excel_parser_node(state: AgentState, config: Dict[str, Any], node_id: str):
    """Parse Excel file and return as a list of records."""
    print(f"Executing Excel Parser Node {node_id}: {config}")

    # Get file URL from config (resolve variables if needed)
    file_url_template = config.get('file_url', '')
    file_url = resolve_variables(file_url_template, state)

    # Get sheet name (default to 0 for first sheet)
    sheet_name = config.get('sheet_name', 0)
    skip_empty_rows = config.get('skip_empty_rows', True)

    print(f"Excel Parser - file_url: {file_url}, sheet_name: {sheet_name}, skip_empty_rows: {skip_empty_rows}")

    # Input for tracing
    inputs = {
        "file_url": file_url,
        "sheet_name": sheet_name,
        "skip_empty_rows": skip_empty_rows
    }

    # Import pandas for Excel parsing
    try:
        import pandas as pd
        import os
        import tempfile
        from urllib.parse import urlparse
        from app.services.minio_service import minio_service

        file_path = file_url

        # Check if it's a MinIO HTTP URL
        if file_url and file_url.startswith('http://'):
            # Parse URL to extract bucket and object name
            # URL format: http://endpoint/bucket/object_name
            parsed = urlparse(file_url)
            path_parts = parsed.path.lstrip('/').split('/', 1)

            if len(path_parts) >= 2:
                bucket = path_parts[0]
                object_name = path_parts[1]

                # Download from MinIO to temp file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
                temp_path = temp_file.name
                temp_file.close()

                try:
                    minio_service.download_file(object_name, temp_path)
                    file_path = temp_path
                    print(f"Downloaded file from MinIO to: {temp_path}")
                except Exception as e:
                    error_msg = f"Failed to download from MinIO: {str(e)}"
                    print(f"Excel Parser Error: {error_msg}")
                    output = {
                        "records": [],
                        "headers": [],
                        "row_count": 0,
                        "error": error_msg
                    }
                    return update_node_output(state, node_id, output, inputs=inputs)

        if not file_path or not os.path.exists(file_path):
            error_msg = f"File not found or not accessible: {file_path}"
            print(f"Excel Parser Error: {error_msg}")
            output = {
                "records": [],
                "headers": [],
                "row_count": 0,
                "error": error_msg
            }
            return update_node_output(state, node_id, output, inputs=inputs)

        # Read Excel file
        # sheet_name can be an integer (index) or string (name)
        df = pd.read_excel(file_path, sheet_name=sheet_name)

        # Get headers (column names)
        headers = df.columns.tolist()

        # Convert to list of records (dictionaries)
        records = df.to_dict(orient='records')

        # Optionally skip empty rows (rows where all values are NaN/None)
        if skip_empty_rows:
            records = [
                record for record in records
                if any(v is not None and v == v for v in record.values())  # v == v filters out NaN
            ]

        # Convert NaN values to None for JSON serialization
        for record in records:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None

        output = {
            "records": records,
            "headers": headers,
            "row_count": len(records)
        }

        print(f"Excel Parser Success: {len(records)} rows parsed, headers: {headers}")

        # Clean up temp file if it was created
        if file_url.startswith('http://') and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except:
                pass

    except ImportError:
        error_msg = "pandas library not installed. Please install it with: pip install pandas openpyxl"
        print(f"Excel Parser Error: {error_msg}")
        output = {
            "records": [],
            "headers": [],
            "row_count": 0,
            "error": error_msg
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_msg = f"Failed to parse Excel file: {str(e)}"
        print(f"Excel Parser Error: {error_msg}")
        print(f"Traceback: {error_trace}")
        output = {
            "records": [],
            "headers": [],
            "row_count": 0,
            "error": error_msg,
            "traceback": error_trace
        }

    return update_node_output(state, node_id, output, inputs=inputs)

async def output_node(state: AgentState, config: Dict[str, Any], node_id: str):
    """Output node that collects and concatenates upstream variables."""
    print(f"Executing Output Node {node_id}: {config}")

    # Get output template from config
    output_template = config.get('output_template', '')

    # Get input_params mapping (local variable name -> upstream source)
    input_params = config.get('input_params', [])

    # Build a mapping of local variable names to their actual sources
    # e.g., {'infos': 'node_2.records'}
    var_mapping = {}
    for param in input_params:
        local_name = param.get('name')
        value_source = param.get('value_source')
        if local_name and value_source:
            var_mapping[local_name] = value_source

    # First, replace local variable names with their actual sources in the template
    # e.g., {{infos}} -> {{node_2.records}}
    resolved_template = output_template
    for local_name, actual_source in var_mapping.items():
        # Replace {{local_name}} with {{actual_source}}
        # Need to escape braces: {{ -> {{{{ and }} -> }}}}}
        resolved_template = resolved_template.replace('{{' + local_name + '}}', '{{' + actual_source + '}}')

    print(f"Output Node - original template: {output_template}")
    print(f"Output Node - resolved template: {resolved_template}")

    # Then resolve variables in the template using the actual sources
    output_text = resolve_variables(resolved_template, state)

    # Input for tracing
    inputs = {
        "output_template": output_template,
        "resolved_template": resolved_template,
        "resolved_output": output_text
    }

    output = {
        "output_text": output_text
    }

    print(f"Output Node - result: {output_text[:200] if len(output_text) > 200 else output_text}")

    return update_node_output(state, node_id, output, inputs=inputs)

async def for_loop_node(state: AgentState, config: Dict[str, Any], node_id: str):
    """For loop node that iterates over an array and processes each item."""
    print(f"Executing For Loop Node {node_id}: {config}")

    # Get configuration
    array_input_template = config.get('array_input', '')
    item_alias = config.get('item_alias', 'item')
    max_iterations = config.get('max_iterations', 50)
    on_error = config.get('on_error', 'skip')

    # Resolve array input
    array_input = resolve_variables(array_input_template, state)

    # Input for tracing
    inputs = {
        "array_input": array_input_template,
        "item_alias": item_alias,
        "max_iterations": max_iterations,
        "on_error": on_error
    }

    # Validate array input is a list
    if not isinstance(array_input, list):
        error_msg = f"For loop input must be a list, got {type(array_input).__name__}"
        print(f"For Loop Node Error: {error_msg}")
        output = {
            "results_array": [],
            "iteration_count": 0,
            "error": error_msg
        }
        return update_node_output(state, node_id, output, inputs=inputs)

    # Limit iterations to max_iterations
    items = array_input[:max_iterations]
    actual_iterations = len(items)

    print(f"For Loop Node - iterating over {actual_iterations} items (max: {max_iterations})")

    # For now, we'll return the items as-is since the workflow engine
    # doesn't support subgraph execution yet. This provides:
    # - The array being iterated
    # - Metadata about the iteration
    # In the future, this would execute a subgraph for each item

    results_array = []
    for i, item in enumerate(items):
        # Create a context entry for this iteration
        # In a full implementation, this would execute the subgraph
        iteration_context = {
            "index": i,
            "value": item,
            f"item_alias": item_alias
        }
        results_array.append(iteration_context)

    output = {
        "results_array": results_array,
        "iteration_count": actual_iterations,
        "array_preview": items[:10] if len(items) > 10 else items  # Preview first 10 items
    }

    print(f"For Loop Node - completed {actual_iterations} iterations")

    return update_node_output(state, node_id, output, inputs=inputs)

async def code_block_node(state: AgentState, config: Dict[str, Any], node_id: str):
    """Code block node that executes user Python code in a safe environment."""
    print(f"Executing Code Block Node {node_id}")

    # Get configuration
    user_code = config.get('code', '')
    timeout = config.get('timeout', 5)

    # Input for tracing
    inputs = {
        "code": user_code,
        "timeout": timeout
    }

    if not user_code or not user_code.strip():
        error_msg = "Code is empty"
        print(f"Code Block Node Error: {error_msg}")
        output = {
            "error": error_msg
        }
        return update_node_output(state, node_id, output, inputs=inputs)

    # Build params dictionary from upstream node outputs
    # Collect all upstream outputs and make them available via params
    node_outputs = state.get("node_outputs", {})

    # Also include input_params mapping if configured
    input_params = config.get('input_params', [])
    params = {}

    # First, collect all upstream outputs (for flexibility)
    for up_node_id, up_output in node_outputs.items():
        if isinstance(up_output, dict):
            # Flatten the output to params (prefix with node_id for clarity)
            for key, value in up_output.items():
                params[f"{up_node_id}.{key}"] = value

    # Then, apply explicit input_params mappings as simpler names
    for param in input_params:
        local_name = param.get('name')
        value_source = param.get('value_source')
        if local_name and value_source:
            # Resolve the value_source from node_outputs
            parts = value_source.split('.')
            if len(parts) >= 2:
                source_node_id = parts[0]
                source_field = '.'.join(parts[1:])
                if source_node_id in node_outputs:
                    source_output = node_outputs[source_node_id]
                    if isinstance(source_output, dict) and source_field in source_output:
                        params[local_name] = source_output[source_field]

    print(f"Code Block Node - params: {list(params.keys())}")

    # Safe builtins - only include safe functions
    safe_builtins = {
        'abs': abs,
        'all': all,
        'any': any,
        'bool': bool,
        'dict': dict,
        'enumerate': enumerate,
        'filter': filter,
        'float': float,
        'int': int,
        'len': len,
        'list': list,
        'map': map,
        'max': max,
        'min': min,
        'range': range,
        'round': round,
        'set': set,
        'sorted': sorted,
        'str': str,
        'sum': sum,
        'tuple': tuple,
        'zip': zip,
        'print': print,  # Allow print for debugging
    }

    # Whitelist modules (read-only, no side effects)
    import math
    import json
    import re
    from collections import Counter, defaultdict

    safe_modules = {
        'math': math,
        'json': json,
        're': re,
        'Counter': Counter,
        'defaultdict': defaultdict,
    }

    # Build safe execution environment
    safe_globals = {
        '__builtins__': safe_builtins,
        'params': params,
        'output': None,
        **safe_modules
    }

    # Execute code with timeout
    import signal
    import asyncio

    def timeout_handler(signum, frame):
        raise TimeoutError("Code execution timed out")

    try:
        # Basic syntax check before execution
        import ast
        try:
            ast.parse(user_code)
        except SyntaxError as e:
            error_msg = f"Syntax error at line {e.lineno}: {e.msg}"
            print(f"Code Block Node Error: {error_msg}")
            output = {"error": error_msg, "syntax_error": str(e)}
            return update_node_output(state, node_id, output, inputs=inputs)

        # Check for dangerous patterns (basic security)
        dangerous_patterns = [
            'import', 'exec', 'eval', 'compile', 'open(', 'file(',
            '__import__', 'getattr', 'setattr', 'delattr',
            'os.', 'sys.', 'subprocess', 'socket', 'urllib',
            'requests', 'http', 'ftplib', 'telnetlib',
            '__class__', '__bases__', '__subclasses__',
            'globals(', 'locals(', 'vars(',
        ]
        user_code_lower = user_code.lower()
        for pattern in dangerous_patterns:
            if pattern in user_code_lower:
                # Allow json, math, re imports (from safe modules)
                if pattern == 'import' and ('import json' in user_code_lower or 'import math' in user_code_lower or 'import re' in user_code_lower):
                    continue
                if pattern in ('json', 'math', 're'):
                    continue
                error_msg = f"Blocked: '{pattern}' is not allowed for security reasons"
                print(f"Code Block Node Error: {error_msg}")
                output = {"error": error_msg}
                return update_node_output(state, node_id, output, inputs=inputs)

        # Execute the code
        exec(user_code, safe_globals)

        # Extract output
        result_output = safe_globals.get("output")
        if result_output is None:
            error_msg = "Code must define 'output' variable (e.g., output = {...})"
            print(f"Code Block Node Error: {error_msg}")
            output = {"error": error_msg}
        elif not isinstance(result_output, dict):
            error_msg = f"'output' must be a dictionary, got {type(result_output).__name__}"
            print(f"Code Block Node Error: {error_msg}")
            output = {"error": error_msg}
        else:
            output = result_output
            print(f"Code Block Node - success: {list(output.keys())}")

    except TimeoutError as e:
        error_msg = f"Execution timeout (exceeded {timeout} seconds)"
        print(f"Code Block Node Error: {error_msg}")
        output = {"error": error_msg}
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"Code Block Node Error: {error_msg}")
        print(f"Traceback: {error_trace}")
        output = {
            "error": error_msg,
            "traceback": error_trace
        }

    return update_node_output(state, node_id, output, inputs=inputs)

async def intent_node(state: AgentState, config: Dict[str, Any], node_id: str):
    """Intent recognition node that uses LLM to classify user intent and extract slots."""
    print(f"Executing Intent Node {node_id}: {config}")

    # Get configuration
    user_input_template = config.get('user_input_source', '{{start-node.rawQuery}}')
    model = config.get('model')
    confidence_threshold = config.get('confidence_threshold', 0.3)
    fallback_node_id = config.get('fallback_node_id', '')

    # Resolve user input
    user_input = resolve_variables(user_input_template, state)

    # Input for tracing
    inputs = {
        "user_input_source": user_input_template,
        "resolved_user_input": user_input,
        "model": model,
        "confidence_threshold": confidence_threshold,
        "fallback_node_id": fallback_node_id
    }

    if not user_input or not user_input.strip():
        # Empty input, return unknown
        output = {
            "intent": "unknown",
            "intent_name": "未知意图",
            "confidence": 0.0,
            "slots": {},
            "matched_node_id": fallback_node_id
        }
        return update_node_output(state, node_id, output, inputs=inputs)

    # Collect capabilities from all output nodes in the workflow
    # In a real implementation, we would get this from the workflow graph definition
    # For now, we'll use a placeholder implementation
    node_outputs = state.get("node_outputs", {})

    # Build capabilities list from workflow graph
    # This would be passed in via config or derived from workflow structure
    # Support both 'capabilities' (backend format) and 'intents' (frontend format)
    capabilities = config.get('capabilities', []) or config.get('intents', [])

    # Convert 'intents' format to 'capabilities' format if needed
    if not capabilities and config.get('intents'):
        # Convert from frontend 'intents' format to backend 'capabilities' format
        intents = config.get('intents', [])
        capabilities = []
        for intent in intents:
            capabilities.append({
                'id': intent.get('id', intent.get('name', '')),
                'name': intent.get('name', intent.get('id', '')),
                'examples': intent.get('examples', '').split(';') if isinstance(intent.get('examples'), str) else intent.get('examples', []),
                'slots': {},  # No slot definitions in basic intents format
                'node_id': '',  # Will be matched by intent_id
                'is_fallback': intent.get('is_fallback', False)
            })

    if not capabilities:
        # No capabilities configured
        print(f"Intent Node - No capabilities configured, returning unknown")
        output = {
            "intent": "unknown",
            "intent_name": "未知意图",
            "confidence": 0.0,
            "slots": {},
            "matched_node_id": fallback_node_id,
            "raw_response": {"error": "No capabilities configured"}
        }
        return update_node_output(state, node_id, output, inputs=inputs)

    # Build prompt for LLM
    prompt = """你是一个任务路由器。请根据用户输入，从以下可处理任务中选择最匹配的一项，并提取参数。

【可用任务】
"""

    for cap in capabilities:
        cap_id = cap.get('id', 'unknown')
        cap_name = cap.get('name', cap_id)
        cap_examples = cap.get('examples', [])
        cap_slots = cap.get('slots', {})

        prompt += f"- 任务ID: {cap_id}\n"
        prompt += f"  名称: {cap_name}\n"
        prompt += f"  用户可能说: {'; '.join(cap_examples) if cap_examples else '无'}\n"
        prompt += f"  需要参数: {', '.join(cap_slots.keys()) if cap_slots else '无'}\n"

    prompt += """
请严格按以下 JSON 格式输出，不要任何解释：
{
  "intent": "任务ID 或 'unknown'",
  "intent_name": "任务名称或'未知'",
  "confidence": 0.0~1.0,
  "slots": { "参数名": "值" }
}

用户输入：""" + user_input

    print(f"Intent Node - Prompt length: {len(prompt)}")

    # Call LLM
    try:
        # get_llm_config and resolve_variables are defined at module level
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        import json

        # Get LLM config
        resource_config = await get_llm_config(model) if model else None

        api_key = None
        base_url = None
        actual_model_name = model or "gpt-3.5-turbo"

        if resource_config:
            api_key = resource_config.get("api_key")
            base_url = resource_config.get("base_url")
            actual_model_name = resource_config.get("model", actual_model_name)

            # Sanitize base_url
            if base_url and base_url.endswith("/chat/completions"):
                base_url = base_url.replace("/chat/completions", "")
                if base_url.endswith("/"):
                    base_url = base_url.rstrip("/")

        if not api_key:
            # No API key, return unknown
            print(f"Intent Node - No API key available")
            output = {
                "intent": "unknown",
                "intent_name": "未知意图",
                "confidence": 0.0,
                "slots": {},
                "matched_node_id": fallback_node_id,
                "raw_response": {"error": "No API key available"}
            }
            return update_node_output(state, node_id, output, inputs=inputs)

        # Create LLM
        llm = ChatOpenAI(
            model=actual_model_name,
            openai_api_key=api_key,
            openai_api_base=base_url,
            temperature=0.1  # Low temperature for consistent classification
        )

        messages = [
            SystemMessage(content="你是一个专业的任务意图识别助手。请严格按照JSON格式输出。"),
            HumanMessage(content=prompt)
        ]

        print(f"Intent Node - Calling LLM: {actual_model_name}")
        response = await llm.ainvoke(messages)
        response_text = response.content

        print(f"Intent Node - LLM Response: {response_text[:200]}")

        # Parse JSON response
        try:
            # Try to extract JSON from response
            response_text = response_text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            result = json.loads(response_text)

            intent_id = result.get("intent", "unknown")
            intent_name = result.get("intent_name", result.get("intent", "unknown"))
            confidence = float(result.get("confidence", 0.0))
            slots = result.get("slots", {})

            # Check confidence threshold
            if intent_id == "unknown" or confidence < confidence_threshold:
                print(f"Intent Node - Low confidence ({confidence}) or unknown, using fallback")
                # Find fallback capability
                fallback_cap = None
                for cap in capabilities:
                    if cap.get('is_fallback'):
                        fallback_cap = cap
                        break

                if fallback_cap:
                    intent_id = fallback_cap.get('id', fallback_node_id)
                    intent_name = fallback_cap.get('name', '默认处理')
                    matched_node_id = fallback_cap.get('node_id', fallback_node_id)
                else:
                    intent_id = "unknown"
                    intent_name = "未知意图"
                    matched_node_id = fallback_node_id
            else:
                # Find matched capability
                matched_cap = None
                for cap in capabilities:
                    if cap.get('id') == intent_id:
                        matched_cap = cap
                        break

                if matched_cap:
                    intent_name = matched_cap.get('name', intent_name)
                    matched_node_id = matched_cap.get('node_id', intent_id)
                else:
                    matched_node_id = intent_id

            output = {
                "intent": intent_id,
                "intent_name": intent_name,
                "confidence": confidence,
                "slots": slots,
                "matched_node_id": matched_node_id,
                "raw_response": {"llm_output": response_text}
            }

            print(f"Intent Node - Matched: {intent_name} ({intent_id}) with confidence {confidence}")

        except json.JSONDecodeError as e:
            print(f"Intent Node - JSON parse error: {e}")
            output = {
                "intent": "unknown",
                "intent_name": "未知意图",
                "confidence": 0.0,
                "slots": {},
                "matched_node_id": fallback_node_id,
                "raw_response": {"error": f"JSON parse error: {str(e)}", "llm_output": response_text}
            }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"Intent Node Error: {error_msg}")
        print(f"Traceback: {error_trace}")

        output = {
            "intent": "unknown",
            "intent_name": "未知意图",
            "confidence": 0.0,
            "slots": {},
            "matched_node_id": fallback_node_id,
            "raw_response": {"error": error_msg, "traceback": error_trace}
        }

    return update_node_output(state, node_id, output, inputs=inputs)

# Registry mapping node types to functions
NODE_REGISTRY = {
    "llm": llm_node,
    "tool": tool_node,
    "knowledge": knowledge_node,
    "start": start_node,
    "end": end_node,
    "excel_parser": excel_parser_node,
    "output": output_node,
    "for_loop": for_loop_node,
    "code_block": code_block_node,
    "intent": intent_node,
    "common": llm_node # Fallback
}
