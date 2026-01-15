#!/usr/bin/env python
"""
Create sample tools for demonstration purposes.
"""
import asyncio
from app.core.database import get_session
from app.models.tool import Tool


async def create_sample_tools():
    """Create sample tools in the database."""
    sample_tools = [
        Tool(
            name='web_search',
            description='Search the web for information',
            type='api',
            config={
                'url': 'https://api.example.com/search',
                'method': 'GET',
                'parameters': {
                    'query': {'type': 'string', 'required': True, 'description': 'Search query'}
                }
            }
        ),
        Tool(
            name='calculator',
            description='Perform mathematical calculations',
            type='function',
            config={
                'function': 'calculate',
                'parameters': {
                    'expression': {'type': 'string', 'required': True, 'description': 'Math expression'}
                }
            }
        ),
        Tool(
            name='weather',
            description='Get current weather information',
            type='api',
            config={
                'url': 'https://api.weather.example/current',
                'method': 'GET',
                'parameters': {
                    'location': {'type': 'string', 'required': True, 'description': 'City name'}
                }
            }
        ),
        Tool(
            name='file_reader',
            description='Read files from the file system',
            type='function',
            config={
                'function': 'read_file',
                'parameters': {
                    'path': {'type': 'string', 'required': True, 'description': 'File path'}
                }
            }
        ),
        Tool(
            name='email_sender',
            description='Send emails to recipients',
            type='api',
            config={
                'url': 'https://api.example.com/email',
                'method': 'POST',
                'parameters': {
                    'to': {'type': 'string', 'required': True, 'description': 'Recipient email'},
                    'subject': {'type': 'string', 'required': True, 'description': 'Email subject'},
                    'body': {'type': 'string', 'required': True, 'description': 'Email body'}
                }
            }
        ),
        Tool(
            name='database_query',
            description='Execute SQL queries on the database',
            type='function',
            config={
                'function': 'execute_query',
                'parameters': {
                    'query': {'type': 'string', 'required': True, 'description': 'SQL query'}
                }
            }
        ),
    ]

    async for session in get_session():
        for tool in sample_tools:
            session.add(tool)

        await session.commit()

        print(f'Created {len(sample_tools)} sample tools:')
        for tool in sample_tools:
            print(f'  - {tool.name} ({tool.type}): {tool.description}')
        break


if __name__ == '__main__':
    asyncio.run(create_sample_tools())
