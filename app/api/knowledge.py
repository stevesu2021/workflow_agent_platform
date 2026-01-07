from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
import uuid
import os

from app.core.database import get_session
from app.models.knowledge import KnowledgeBase, Document
from app.schemas.knowledge import (
    KnowledgeBaseCreate, KnowledgeBaseResponse, KnowledgeBaseListResponse, KnowledgeBaseUpdate,
    DocumentResponse, SearchRequest, SearchResponse, SearchResult
)
from app.services.document_service import document_service
from app.services.vector_service import vector_service
from app.services.minio_service import minio_service

router = APIRouter()

@router.get("/", response_model=List[KnowledgeBaseListResponse])
async def list_knowledge_bases(
    session: AsyncSession = Depends(get_session)
):
    # Join with Document to count documents? 
    # For simplicity, we'll fetch all and count in python or do a subquery.
    # Let's just fetch KBs and populate counts.
    result = await session.execute(select(KnowledgeBase).order_by(desc(KnowledgeBase.created_at)))
    kbs = result.scalars().all()
    
    response = []
    for kb in kbs:
        # Count documents
        doc_count_result = await session.execute(select(Document).where(Document.knowledge_base_id == kb.id))
        doc_count = len(doc_count_result.scalars().all())
        
        response.append(KnowledgeBaseListResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            is_published=kb.is_published,
            document_count=doc_count,
            created_at=kb.created_at,
            updated_at=kb.updated_at
        ))
    return response

@router.post("/", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(
    kb_create: KnowledgeBaseCreate,
    session: AsyncSession = Depends(get_session)
):
    kb = KnowledgeBase.from_orm(kb_create)
    session.add(kb)
    await session.commit()
    await session.refresh(kb)
    
    # Manually construct response to avoid lazy loading error for documents relationship
    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        is_published=kb.is_published,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        documents=[]
    )

@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    # Fetch documents
    result = await session.execute(select(Document).where(Document.knowledge_base_id == kb_id).order_by(desc(Document.created_at)))
    documents = result.scalars().all()
    
    # Manually populate documents field since it's not eager loaded by default in SQLModel/Pydantic response model
    # Convert to dict to match response model if needed, or rely on ORM mode
    # Pydantic ORM mode should handle it if we attach the list
    # But documents is a relationship, we might need to be careful.
    # Let's verify DocumentResponse structure matches Document model.
    # Yes.
    
    # We can construct the response manually to be safe
    doc_responses = [DocumentResponse(
        id=d.id,
        knowledge_base_id=d.knowledge_base_id,
        filename=d.filename,
        file_type=d.file_type,
        status=d.status,
        error_message=d.error_message,
        chunk_count=d.chunk_count,
        created_at=d.created_at,
        updated_at=d.updated_at
    ) for d in documents]
    
    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        is_published=kb.is_published,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        documents=doc_responses
    )

@router.post("/{kb_id}/publish", response_model=KnowledgeBaseResponse)
async def publish_knowledge_base(
    kb_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    kb.is_published = True
    session.add(kb)
    await session.commit()
    await session.refresh(kb)
    
    # We need to construct response carefully because of documents relationship
    # But since KnowledgeBaseResponse includes documents, and we just refreshed kb,
    # lazy loading of documents might fail in async unless eager loaded.
    # We can just return basic info or reuse logic.
    # Let's reuse logic from get_knowledge_base but simplified since we might not need documents here or empty.
    # Actually, the response model requires documents list.
    
    # Let's fetch documents to return full response or just empty list if we relax response model?
    # No, schema defines documents: List[DocumentResponse] = []
    
    # Let's fetch docs
    result = await session.execute(select(Document).where(Document.knowledge_base_id == kb_id))
    documents = result.scalars().all()
    
    doc_responses = [DocumentResponse(
        id=d.id,
        knowledge_base_id=d.knowledge_base_id,
        filename=d.filename,
        file_type=d.file_type,
        status=d.status,
        error_message=d.error_message,
        chunk_count=d.chunk_count,
        created_at=d.created_at,
        updated_at=d.updated_at
    ) for d in documents]

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        is_published=kb.is_published,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        documents=doc_responses
    )

@router.post("/{kb_id}/unpublish", response_model=KnowledgeBaseResponse)
async def unpublish_knowledge_base(
    kb_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    kb.is_published = False
    session.add(kb)
    await session.commit()
    await session.refresh(kb)
    
    # Fetch docs
    result = await session.execute(select(Document).where(Document.knowledge_base_id == kb_id))
    documents = result.scalars().all()
    
    doc_responses = [DocumentResponse(
        id=d.id,
        knowledge_base_id=d.knowledge_base_id,
        filename=d.filename,
        file_type=d.file_type,
        status=d.status,
        error_message=d.error_message,
        chunk_count=d.chunk_count,
        created_at=d.created_at,
        updated_at=d.updated_at
    ) for d in documents]

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        is_published=kb.is_published,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        documents=doc_responses
    )

@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    # Delete from vector store
    # Sanitize KB ID for Milvus (replace hyphens with underscores)
    sanitized_kb_id = str(kb_id).replace("-", "_")
    collection_name = f"kb_{sanitized_kb_id}"
    await vector_service.delete_collection(collection_name)
    
    # Documents will be cascade deleted if configured in DB, but SQLModel/SQLAlchemy default might not be cascade
    # Let's delete documents first manually to be safe or rely on DB.
    # We should delete files from disk too.
    # For now, just delete DB record.
    await session.delete(kb)
    await session.commit()
    return {"success": True}

@router.post("/{kb_id}/upload", response_model=DocumentResponse)
async def upload_document(
    kb_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower().replace(".", "")
    if ext not in ["pdf", "txt", "md", "docx"]:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: pdf, txt, md, docx")
    
    # Save file
    file_path = await document_service.save_file(file, kb_id)
    
    # Create Document record
    doc = Document(
        knowledge_base_id=kb_id,
        filename=file.filename,
        file_path=file_path,
        file_type=ext,
        status="pending"
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    
    return doc

async def process_document_task(doc_id: uuid.UUID, session_factory):
    async with session_factory() as session:
        doc = await session.get(Document, doc_id)
        if not doc:
            return
        
        doc.status = "processing"
        session.add(doc)
        await session.commit()
        
        try:
            chunk_count = await document_service.process_document(doc, session)
            doc.status = "completed"
            doc.chunk_count = chunk_count
        except Exception as e:
            doc.status = "error"
            doc.error_message = str(e)
        
        session.add(doc)
        await session.commit()

@router.post("/{kb_id}/documents/{doc_id}/process")
async def process_document_endpoint(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.knowledge_base_id != kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this Knowledge Base")
    
    # We need a new session for background task
    from app.core.database import async_session_maker
    background_tasks.add_task(process_document_task, doc_id, async_session_maker)
    
    return {"message": "Processing started"}

@router.get("/{kb_id}/documents/{doc_id}/preview")
async def preview_document(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.knowledge_base_id != kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this Knowledge Base")
    
    # Call service to get content
    content = await document_service.get_document_content(doc)
    return {"content": content}

@router.get("/{kb_id}/documents/{doc_id}/file")
async def get_document_file(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    download: bool = False,
    session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.knowledge_base_id != kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this Knowledge Base")
    
    # Check MinIO
    try:
        response = minio_service.get_object(doc.file_path)
        
        media_type = "application/octet-stream"
        if doc.file_type == "pdf":
            media_type = "application/pdf"
        elif doc.file_type == "txt":
            media_type = "text/plain"
        elif doc.file_type == "md":
            media_type = "text/markdown"
            
        headers = {}
        if download:
            # RFC 5987
            encoded_filename = quote(doc.filename)
            headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{encoded_filename}"
            
        # Wrap response in an iterator to ensure proper closing
        def iterfile():
            try:
                yield from response.stream(32*1024)
            finally:
                response.close()
                response.release_conn()
                
        return StreamingResponse(
            iterfile(), 
            media_type=media_type,
            headers=headers
        )
    except Exception as e:
        print(f"Error getting file: {type(e).__name__}: {e}")
        raise HTTPException(status_code=404, detail=f"File not found [v2]. Error: {str(e)}")

@router.get("/{kb_id}/documents/{doc_id}/markdown")
async def download_markdown(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Path to parsed markdown
    # Note: DocumentService uses knowledge_base_id/parsed/filename.md
    # Let's verify the path construction in DocumentService
    parsed_object_name = f"{str(kb_id)}/parsed/{doc.filename}.md"
    
    print(f"DEBUG: Attempting to download markdown from: {parsed_object_name}")
    print(f"DEBUG: kb_id type: {type(kb_id)}, value: {kb_id}")
    print(f"DEBUG: doc.filename: {doc.filename}")
    
    try:
        # Check if object exists first? minio_service.get_object throws if not found?
        # get_object returns urllib3 response. If status != 200, it might not raise immediately until read?
        # Actually minio python client get_object raises S3Error if not found.
        # But our minio_service wrapper might be different.
        # Let's try to get it.
        response = minio_service.get_object(parsed_object_name)
        
        # Wrap response in an iterator to ensure proper closing
        def iterfile():
            try:
                yield from response.stream(32*1024)
            finally:
                response.close()
                response.release_conn()
                
        # RFC 5987
        encoded_filename = quote(f"{doc.filename}.md")
        return StreamingResponse(
            iterfile(),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error getting markdown file {parsed_object_name}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=404, detail=f"Markdown file not found ({parsed_object_name}) [v2]. Please process the document first. Error: {str(e)}")

@router.get("/{kb_id}/documents/{doc_id}/chunks", response_model=List[SearchResult])
async def get_document_chunks(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.knowledge_base_id != kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this Knowledge Base")
    
    # Sanitize KB ID for Milvus (replace hyphens with underscores)
    sanitized_kb_id = str(kb_id).replace("-", "_")
    collection_name = f"kb_{sanitized_kb_id}"
    
    # Use search with filter expression to get all chunks for this document
    # We use a dummy query or empty query if supported, but similarity search usually requires query.
    # However, we can use an empty query vector if the underlying store supports it, or just use a dummy query
    # and rely on the filter to get the exact chunks.
    # But wait, Milvus `query` method (not search) is for scalar filtering.
    # `vector_service.search` uses `similarity_search`.
    # Let's extend `vector_service` to support `query` (scalar filtering) or just use `search` with a dummy query and large top_k + filter.
    # Since we want *all* chunks, and we know the count, we can use top_k=doc.chunk_count.
    
    # But better approach: Add a method to VectorService to retrieve by metadata filter without vector search if possible,
    # or just use vector search with dummy query.
    # Let's use vector search with dummy query for now as it's easier given current VectorService structure.
    # We added `expr` support in previous turn plan? No, we didn't implement it yet. 
    # The previous turn plan mentioned adding `expr` support. I should implement it now.
    
    # Wait, the prompt says "The User encourage you to assign read-only tasks...".
    # I need to implement `get_document_chunks`.
    
    # Let's modify VectorService to support filtering first.
    
    # But for now, let's assume I will modify VectorService in the next step.
    # Here is the endpoint logic assuming VectorService has `search` with `expr`.
    
    # Actually, Milvus has a `query` method for scalar retrieval which is more appropriate than `search` (vector similarity).
    # I should add `query` method to VectorService.
    
    results = await vector_service.query(
        collection_name, 
        expr=f'document_id == "{doc_id}"'
    )
    
    # Map results to SearchResult
    chunk_results = []
    for item in results:
        # Item might be a dict from Milvus query
        chunk_results.append(SearchResult(
            id=str(item.get("chunk_id", "")),
            content=item.get("text", ""), # We need to ensure we store text in a field Milvus returns or LangChain stores it
            metadata=item, # This might need cleanup
            score=0.0 # No score for scalar query
        ))
        
    # Wait, LangChain Milvus `query` might not be exposed directly or might behave differently.
    # LangChain's Milvus wrapper stores text in a field (default `text`).
    # Let's look at VectorService implementation again.
    
    return chunk_results
@router.post("/{kb_id}/search", response_model=SearchResponse)
async def search_knowledge_base(
    kb_id: uuid.UUID,
    request: SearchRequest,
    session: AsyncSession = Depends(get_session)
):
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    # Sanitize KB ID for Milvus (replace hyphens with underscores)
    sanitized_kb_id = str(kb_id).replace("-", "_")
    collection_name = f"kb_{sanitized_kb_id}"
    results = await vector_service.search(
        collection_name, 
        request.query, 
        top_k=request.top_k, 
        score_threshold=request.score_threshold
    )
    
    search_results = []
    for doc, score in results:
        search_results.append(SearchResult(
            id=doc.metadata.get("document_id", ""), # This is doc ID
            content=doc.page_content,
            metadata=doc.metadata,
            score=score
        ))
        
    return SearchResponse(results=search_results)
