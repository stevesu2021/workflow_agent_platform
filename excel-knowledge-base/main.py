from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import sys

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), "excel_rag"))

from excel_rag.rag_excel_knowledge_search import ExcelKnowledgeSearch
from excel_rag.rag_excel_knowledge_base import ExcelKnowledgeBase
import uuid

app = FastAPI(
    title="Excel Knowledge Base API",
    description="API for creating and searching knowledge base from Excel files using RAG",
    version="1.0.0"
)

# 全局变量存储知识库实例
knowledge_search: ExcelKnowledgeSearch = None
tobe_included: List[str] = []

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5

class QueryResponse(BaseModel):
    results: List[dict]

class BuildRequest(BaseModel):
    excel_file: str
    tobe_included: List[str]
    knowledge_base_file: Optional[str] = "knowledge_base.pkl"
    knowledge_multi_file: Optional[str] = "knowledge_multi.pkl"

class BuildResponse(BaseModel):
    message: str
    knowledge_base_file: str
    knowledge_multi_file: str

@app.get("/")
def read_root():
    return {"message": "Excel Knowledge Base API", "status": "running"}


@app.post("/build_knowledge_base", response_model=BuildResponse)
def build_knowledge_base(request: BuildRequest):
    global knowledge_search, tobe_included
    
    try:
        # 检查Excel文件是否存在
        if not os.path.exists(request.excel_file):
            raise HTTPException(status_code=404, detail=f"Excel file not found: {request.excel_file}")
        
        # 创建知识库
        kb = ExcelKnowledgeBase(request.excel_file, request.tobe_included)
        kb.create_knowledge_base()
        kb.save_knowledge_base(request.knowledge_base_file)
        kb.create_knowledge_multi()
        kb.save_knowledge_multi(request.knowledge_multi_file)
        
        # 初始化搜索器
        knowledge_search = ExcelKnowledgeSearch(request.knowledge_base_file, request.knowledge_multi_file)
        tobe_included = request.tobe_included
        
        return BuildResponse(
            message="Knowledge base created successfully",
            knowledge_base_file=request.knowledge_base_file,
            knowledge_multi_file=request.knowledge_multi_file
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building knowledge base: {str(e)}")


@app.post("/search", response_model=QueryResponse)
def search(request: QueryRequest):
    global knowledge_search, tobe_included
    
    if knowledge_search is None:
        raise HTTPException(status_code=400, detail="Knowledge base not initialized. Please build knowledge base first.")
    
    try:
        results = knowledge_search.search(tobe_included, request.query, top_k=request.top_k)
        
        # 转换结果格式
        formatted_results = []
        for result in results:
            formatted_results.append({
                "similarity": float(result["similarity"]),
                "data": result["data"],
                "metadata": result["metadata"]
            })
        
        return QueryResponse(results=formatted_results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during search: {str(e)}")


@app.get("/health")
def health_check():
    return {"status": "healthy", "knowledge_base_loaded": knowledge_search is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )