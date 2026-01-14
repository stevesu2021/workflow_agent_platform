import asyncio
import shutil
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from app.models.ai_resource import AiResource

class MCPService:
    @staticmethod
    async def list_tools(resource: AiResource) -> List[Dict[str, Any]]:
        """
        Connect to an MCP server defined in AiResource config and list available tools.
        Config structure expected:
        {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
            "env": {"KEY": "VALUE"}
        }
        """
        config = resource.config
        if not config:
            raise ValueError("MCP Server configuration is empty")
        
        command = config.get("command")
        args = config.get("args", [])
        env = config.get("env", {})
        
        if not command:
            raise ValueError("MCP Server 'command' is required")
            
        # Verify command exists
        if not shutil.which(command):
            raise ValueError(f"Command '{command}' not found in system path")

        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env
        )

        try:
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    
                    # List tools
                    tools_result = await session.list_tools()
                    
                    # Convert MCP tools to a dictionary list
                    tools_data = []
                    for tool in tools_result.tools:
                        tools_data.append({
                            "name": tool.name,
                            "description": tool.description,
                            "inputSchema": tool.inputSchema
                        })
                        
                    return tools_data
        except Exception as e:
            raise RuntimeError(f"Failed to communicate with MCP server: {str(e)}")

mcp_service = MCPService()
