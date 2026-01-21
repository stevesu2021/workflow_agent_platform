
import sys
import json
import os

sys.path.insert(0, "/home/steve/github/workflow_agent_platform/OpenManus/workspace/可研评审")

# Clear proxy environment variables to avoid SOCKS proxy errors
proxy_vars = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']
for var in proxy_vars:
    os.environ.pop(var, None)

os.environ["LLM_API_KEY"] = os.getenv("LLM_API_KEY", "")
os.environ["LLM_BASE_URL"] = os.getenv("LLM_BASE_URL", "")

from agent import create_agent

agent = create_agent()
user_input = "Hello"

try:
    result = agent.run(user_input)
    print(json.dumps({"success": True, "result": str(result)}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
