import requests
import json
import time
import subprocess
import sys
import os
from pathlib import Path

# Add the project directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__)))

# API configuration
BASE_URL = "http://localhost:8000"

def test_api():
    """
    测试Excel知识库API
    """
    print("Testing Excel Knowledge Base API...")
    
    # 检查服务器是否运行
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✓ Server is running")
        else:
            print("✗ Server is not responding properly")
            return
    except requests.exceptions.ConnectionError:
        print("✗ Server is not running. Please start the server first.")
        return
    
    # 检查根路径
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✓ Root endpoint is accessible")
        else:
            print("✗ Root endpoint not accessible")
            return
    except requests.exceptions.RequestException as e:
        print(f"✗ Error accessing root endpoint: {e}")
        return
    
    # 构建知识库 (使用示例Excel文件)
    print("\nBuilding knowledge base...")
    build_payload = {
        "excel_file": "./excel_rag/test.xlsx",
        "tobe_included": ["系统名称", "系统编号"],
        "knowledge_base_file": "knowledge_base.pkl",
        "knowledge_multi_file": "knowledge_multi.pkl"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/build_knowledge_base", json=build_payload)
        if response.status_code == 200:
            print("✓ Knowledge base built successfully")
            result = response.json()
            print(f"Message: {result['message']}")
        else:
            print(f"✗ Failed to build knowledge base: {response.status_code}, {response.text}")
            return
    except requests.exceptions.RequestException as e:
        print(f"✗ Error building knowledge base: {e}")
        return
    
    # 执行搜索
    print("\nSearching knowledge base...")
    search_payload = {
        "query": "系统编号: SYS-014",
        "top_k": 5
    }
    
    try:
        response = requests.post(f"{BASE_URL}/search", json=search_payload)
        if response.status_code == 200:
            print("✓ Search completed successfully")
            results = response.json()['results']
            print(f"Found {len(results)} results:")
            for i, result in enumerate(results[:3]):  # 只显示前3个结果
                print(f"  Result {i+1}: Similarity={result['similarity']:.4f}")
                print(f"    Data: {result['data']}")
                print(f"    Metadata: {result['metadata']}")
        else:
            print(f"✗ Search failed: {response.status_code}, {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"✗ Error during search: {e}")

def test_api_directly():
    """
    直接测试API功能，不依赖服务器
    """
    print("\n" + "="*50)
    print("Testing API functionality directly...")
    
    try:
        from excel_rag.rag_excel_knowledge_base import ExcelKnowledgeBase
        from excel_rag.rag_excel_knowledge_search import ExcelKnowledgeSearch
        import os
        
        # 检查测试文件是否存在
        test_file = "./excel_rag/test.xlsx"
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return
        
        print("Creating knowledge base...")
        kb = ExcelKnowledgeBase(test_file, ["系统名称", "系统编号"])
        kb.create_knowledge_base()
        kb.save_knowledge_base("knowledge_base.pkl")
        kb.create_knowledge_multi()
        kb.save_knowledge_multi("knowledge_multi.pkl")
        print("✓ Knowledge base created successfully")
        
        print("Initializing search engine...")
        search_engine = ExcelKnowledgeSearch('knowledge_base.pkl', 'knowledge_multi.pkl')
        print("✓ Search engine initialized")
        
        print("Performing search...")
        results = search_engine.search(["系统名称", "系统编号"], "系统编号: SYS-014", top_k=5)
        print(f"✓ Found {len(results)} results")
        
        for i, result in enumerate(results[:3]):  # 只显示前3个结果
            print(f"  Result {i+1}: Similarity={result['similarity']:.4f}")
            print(f"    Data: {result['data']}")
            print(f"    Metadata: {result['metadata']}")
        
    except ImportError as e:
        print(f"Import error: {e}")
    except Exception as e:
        print(f"Error in direct test: {e}")

if __name__ == "__main__":
    print("Starting Excel Knowledge Base API tests...")
    
    if len(sys.argv) > 1 and sys.argv[1] == "--direct":
        # 直接测试功能，不通过API
        test_api_directly()
    else:
        # 通过API测试
        test_api()
        print("\nFor direct functionality test (without API server), run: python test_api.py --direct")