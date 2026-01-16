import subprocess
import sys
import os
from pathlib import Path

def start_server():
    """
    启动FastAPI服务器
    """
    print("Starting Excel Knowledge Base API server...")
    
    # 检查依赖
    try:
        import fastapi
        import uvicorn
        import pandas
        import torch
        import transformers
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Please install requirements using: pip install -r requirements.txt")
        return
    
    # 检查模型路径
    model_path = "/home/steve/models/Qwen3-Embedding-0.6B/"
    if not os.path.exists(model_path):
        print(f"Warning: Model path does not exist: {model_path}")
        print("Make sure the embedding model is properly installed.")
    
    # 启动uvicorn服务器
    try:
        import uvicorn
        from main import app
        
        print("Excel Knowledge Base API server is starting on http://0.0.0.0:8000")
        print("Docs available at http://0.0.0.0:8000/docs")
        
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=False  # 生产环境设置为False
        )
    except Exception as e:
        print(f"Error starting server: {e}")

if __name__ == "__main__":
    start_server()