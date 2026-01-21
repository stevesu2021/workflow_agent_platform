"""
Configuration for 可研评审 Agent
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
    model: str = os.getenv("LLM_MODEL", "mimo-v2-flash")
    base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    api_key: str = os.getenv("LLM_API_KEY", "")
    temperature: float = 0.7
    max_tokens: int = 4096


@dataclass
class KnowledgeBaseConfig:
    """Knowledge base configuration."""
    enabled: bool = True
    base_url: str = os.getenv("KB_BASE_URL", "http://localhost:8001")
    knowledge_bases: list = None

    def __post_init__(self):
        if self.knowledge_bases is None:
            self.knowledge_bases = ['d38f78a9-19dd-45cd-8286-390f4638764e']


@dataclass
class 可研评审Config:
    """Main configuration for 可研评审 agent."""
    llm: LLMConfig = None
    knowledge_base: KnowledgeBaseConfig = None
    max_thoughts: int = 5
    tools: list = None

    def __post_init__(self):
        if self.llm is None:
            self.llm = LLMConfig()
        if self.knowledge_base is None:
            self.knowledge_base = KnowledgeBaseConfig()
        if self.tools is None:
            self.tools = []


# Global config instance
config = 可研评审Config()

# Alias for backward compatibility
AgentConfig = 可研评审Config
