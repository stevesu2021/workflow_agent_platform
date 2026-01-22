
import sys
import json
import os

sys.path.insert(0, "/home/steve/github/workflow_agent_platform/OpenManus/workspace/可研评审")

# Clear proxy environment variables to avoid SOCKS proxy errors
proxy_vars = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']
for var in proxy_vars:
    os.environ.pop(var, None)

# Load .env file from workspace directory
env_file = os.path.join("/home/steve/github/workflow_agent_platform/OpenManus/workspace/可研评审", ".env")
if os.path.exists(env_file):
    from dotenv import load_dotenv
    load_dotenv(env_file)
    print("Loaded .env from:", env_file, file=sys.stderr)
else:
    print("Warning: .env file not found at:", env_file, file=sys.stderr)

from agent import create_agent

agent = create_agent()
user_input = "Hello"

try:
    result = agent.run(user_input)
    print(json.dumps({"success": True, "result": str(result)}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
