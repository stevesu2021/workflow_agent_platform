
import sys
import json
import os

# Add workspace to path
sys.path.insert(0, "./OpenManus/workspace/可研评审")

# Set environment variables for LLM
os.environ["LLM_API_KEY"] = os.getenv("LLM_API_KEY", "")
os.environ["LLM_BASE_URL"] = os.getenv("LLM_BASE_URL", "")

# Import and run agent
from agent import create_agent

# Run agent
agent = create_agent()
user_input = {"待评审的材料": {"uid": "rc-upload-1768815080460-7"}}

try:
    result = agent.run(user_input)
    print(json.dumps({"success": True, "result": str(result)}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
