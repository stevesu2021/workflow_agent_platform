import httpx
import asyncio

BASE_URL = "http://localhost:8001"

async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Generate Agent from Text
        print("\n--- 1. Generating Agent ---")
        response = await client.post("/agents/generate", json={
            "description": "Create a customer service agent that can search for order status and summarize the result using an LLM."
        })
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return
        
        agent_graph = response.json()
        print("Generated Graph Nodes:", [node['type'] for node in agent_graph['nodes']])
        
        # 2. Create Agent
        print("\n--- 2. Creating Agent ---")
        agent_data = {
            "name": "Order Helper",
            "description": "Helps with orders",
            "flow_json": agent_graph
        }
        response = await client.post("/agents/", json=agent_data)
        if response.status_code != 200:
             print(f"Error: {response.text}")
             return
        
        agent = response.json()
        agent_id = agent['id']
        print(f"Created Agent ID: {agent_id}")
        
        # 3. Run Agent
        print("\n--- 3. Running Agent ---")
        run_input = {"input": "Check status for order #12345"}
        response = await client.post(f"/agents/{agent_id}/run", json=run_input)
        
        if response.status_code != 200:
             print(f"Error: {response.text}")
             return
             
        result = response.json()
        print(f"Run Result: {result}")

if __name__ == "__main__":
    asyncio.run(main())
