import asyncio
import os
import uuid
import sys

# Ensure app is in path
sys.path.append(os.getcwd())

from app.services.vector_service import vector_service

async def test_milvus():
    print("Testing Milvus Integration...")
    
    collection_name = f"test_kb_{uuid.uuid4().hex}"
    print(f"Collection Name: {collection_name}")
    
    texts = [
        "Milvus is an open-source vector database.",
        "It is designed for scalable similarity search.",
        "LangChain integrates well with Milvus."
    ]
    metadatas = [
        {"source": "doc1", "page": 1},
        {"source": "doc1", "page": 2},
        {"source": "doc2", "page": 1}
    ]
    ids = [str(i) for i in range(len(texts))]
    
    try:
        print("Adding texts...")
        await vector_service.add_texts(collection_name, texts, metadatas, ids)
        
        print("Searching...")
        query = "What is Milvus?"
        results = await vector_service.search(collection_name, query, top_k=2)
        
        print(f"Search results for '{query}':")
        for doc, score in results:
            print(f" - Score: {score}, Content: {doc.page_content}, Meta: {doc.metadata}")
            
        if len(results) > 0:
            print("Test PASSED!")
        else:
            print("Test FAILED: No results found.")
        
    except Exception as e:
        print(f"Test FAILED: {e}")
        print("Ensure Milvus is running (e.g., via docker-compose-milvus.yml)")
    finally:
        print("Cleaning up...")
        await vector_service.delete_collection(collection_name)

if __name__ == "__main__":
    asyncio.run(test_milvus())
