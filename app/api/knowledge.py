from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
import uuid
import os
import logging

from app.core.database import get_session
from app.models.knowledge import KnowledgeBase, Document
from app.schemas.knowledge import (
    KnowledgeBaseCreate, KnowledgeBaseResponse, KnowledgeBaseListResponse, KnowledgeBaseUpdate,
    DocumentResponse, SearchRequest, SearchResponse, SearchResult
)
from app.services.document_service import document_service
from app.services.vector_service import vector_service
from app.services.minio_service import minio_service
from app.services.excel_service import excel_knowledge_service

router = APIRouter()
logger = logging.getLogger(__name__)

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
            type=kb.type,
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
        type=kb.type,
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
        type=kb.type,
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
        type=kb.type,
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
        type=kb.type,
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

    # First, delete all documents associated with this knowledge base
    # This is needed because of the foreign key constraint
    result = await session.execute(
        select(Document).where(Document.knowledge_base_id == kb_id)
    )
    documents = result.scalars().all()

    for doc in documents:
        # Delete from Milvus for each document's chunks
        # Note: We'll delete the entire collection below, so this is optional
        await session.delete(doc)

    # Delete from vector store
    # Sanitize KB ID for Milvus (replace hyphens with underscores)
    sanitized_kb_id = str(kb_id).replace("-", "_")
    collection_name = f"kb_{sanitized_kb_id}"
    await vector_service.delete_collection(collection_name)

    # Now delete the knowledge base
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
    if ext not in ["pdf", "txt", "md", "docx", "xlsx", "xls"]:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: pdf, txt, md, docx, xlsx, xls")
    
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

    # For Excel files, try to get chunks by document_id (new data)
    # If no document_id field exists (old data), get all chunks and return them
    # since old Excel files only have one document per knowledge base typically
    from pymilvus import Collection, utility

    if not utility.has_collection(collection_name):
        return []

    try:
        col = Collection(collection_name)
        col.load()

        # Try with document_id filter first (new data)
        results = col.query(expr=f'document_id == "{doc_id}"', output_fields=["text", "chunk_id", "pk", "row_index", "full_data", "document_id"])

        # If empty, it might be old data without document_id field
        # Try getting all data for Excel files
        if not results and doc.file_type in ["xlsx", "xls"]:
            results = col.query(expr="", limit=1000, output_fields=["text", "chunk_id", "pk", "row_index", "full_data", "document_id"])

        # Map results to SearchResult
        chunk_results = []
        for item in results:
            # Get text content - might be in different fields
            text_content = item.get("text", "")

            # If no text field, try to construct from metadata
            if not text_content:
                # For Excel data, construct from row data
                row_data = item.get("full_data", {})
                if row_data:
                    text_content = " ".join([f"{k}: {v}" for k, v in row_data.items() if v])

            chunk_results.append(SearchResult(
                id=str(item.get("chunk_id", item.get("pk", ""))),
                content=text_content,
                metadata=item,
                score=0.0
            ))

        return chunk_results

    except Exception as e:
        logger.error(f"Error getting chunks: {e}")
        # Fallback: try to get all data
        try:
            from pymilvus import Collection
            col = Collection(collection_name)
            col.load()
            results = col.query(expr="", limit=1000, output_fields=["text", "chunk_id", "pk", "row_index", "full_data", "document_id"])

            chunk_results = []
            for item in results:
                text_content = item.get("text", "")
                if not text_content:
                    row_data = item.get("full_data", {})
                    if row_data:
                        text_content = " ".join([f"{k}: {v}" for k, v in row_data.items() if v])

                chunk_results.append(SearchResult(
                    id=str(item.get("chunk_id", item.get("pk", ""))),
                    content=text_content,
                    metadata=item,
                    score=0.0
                ))
            return chunk_results
        except Exception as e2:
            logger.error(f"Fallback also failed: {e2}")
            return []
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

    search_results = []
    query_lower = request.query.lower()

    # For Excel type KBs, always do text-based matching to ensure consistency
    # This is necessary when using FakeEmbeddings where vectors are random
    if kb.type == "excel":
        from pymilvus import Collection, utility

        if utility.has_collection(collection_name):
            try:
                col = Collection(collection_name)
                col.load()

                # Get all data and find matches
                all_data = col.query(expr="", limit=1000, output_fields=["text", "chunk_id", "pk", "row_index", "full_data"])

                # Find all matches and score them
                text_matches = []
                for item in all_data:
                    text_content = item.get("text", "")
                    if not text_content:
                        row_data = item.get("full_data", {})
                        if row_data:
                            text_content = " ".join([f"{k}: {v}" for k, v in row_data.items() if v])

                    if query_lower in text_content.lower():
                        chunk_id = str(item.get("chunk_id", item.get("pk", "")))

                        # Calculate score based on match quality
                        import re
                        if re.search(r'\b' + re.escape(query_lower) + r'\b', text_content.lower()):
                            # Complete word match
                            score = 0.95
                        else:
                            # Partial match
                            score = 0.85

                        text_matches.append((chunk_id, text_content, item, score))

                # Sort by score descending and take top_k
                text_matches.sort(key=lambda x: x[3], reverse=True)
                text_matches = text_matches[:request.top_k]

                # Convert to SearchResult format
                for chunk_id, content, metadata, score in text_matches:
                    search_results.append(SearchResult(
                        id=chunk_id,
                        content=content,
                        metadata=metadata,
                        score=score
                    ))

                return SearchResponse(results=search_results)

            except Exception as e:
                logger.error(f"Text-based search failed: {e}")
                import traceback
                traceback.print_exc()

    # For non-Excel KBs or if text search failed, use vector search
    results = await vector_service.search(
        collection_name,
        request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold
    )

    for doc, score in results:
        content = doc.page_content
        content_lower = content.lower()

        # Calculate adjusted score based on text matching
        adjusted_score = score

        if query_lower in content_lower:
            # For exact matches, boost score
            import re
            if re.search(r'\b' + re.escape(query_lower) + r'\b', content_lower):
                adjusted_score = max(score, 0.95)
            else:
                adjusted_score = max(score, 0.8)

        search_results.append(SearchResult(
            id=doc.metadata.get("document_id", ""),
            content=content,
            metadata=doc.metadata,
            score=adjusted_score
        ))

    # For non-Excel KBs, sort by score descending and limit
    # (For Excel KBs, sorting and limiting is already done above)
    if kb.type != "excel":
        search_results.sort(key=lambda x: x.score, reverse=True)
        search_results = search_results[:request.top_k]

    return SearchResponse(results=search_results)


# Excel Upload Endpoints

@router.post("/{kb_id}/upload-excel", response_model=DocumentResponse)
async def upload_excel_document(
    kb_id: uuid.UUID,
    file: UploadFile = File(...),
    metadata_columns: Optional[str] = Form(None),  # JSON string of column names
    session: AsyncSession = Depends(get_session)
):
    """
    Upload an Excel file to the knowledge base.

    Args:
        kb_id: Knowledge base ID
        file: Excel file (.xlsx, .xls)
        metadata_columns: Optional JSON string of column names to use for metadata.
                         If not provided, all columns will be used.
    """
    import json

    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower().replace(".", "")
    if ext not in ["xlsx", "xls"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: xlsx, xls"
        )

    # Parse metadata columns if provided
    columns_list = None
    if metadata_columns:
        try:
            columns_list = json.loads(metadata_columns)
            if not isinstance(columns_list, list):
                raise ValueError("metadata_columns must be a list")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid metadata_columns format: {str(e)}"
            )

    # Read file content
    file_content = await file.read()

    # Create Document record with metadata
    doc = Document(
        knowledge_base_id=kb_id,
        filename=file.filename,
        file_path="",  # Will be set by excel service
        file_type=ext,
        status="processing",
        extra_metadata={"excel_columns": columns_list} if columns_list else None
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    # Process Excel file in background
    from app.core.database import async_session_maker

    async def process_excel_task(doc_id: uuid.UUID, content: bytes, filename: str, columns: Optional[List[str]]):
        async with async_session_maker() as session:
            doc = await session.get(Document, doc_id)
            if not doc:
                return

            try:
                result = await excel_knowledge_service.process_excel_upload(
                    file_content=content,
                    filename=filename,
                    kb_id=str(kb_id),
                    doc_id=str(doc_id),
                    metadata_columns=columns
                )

                # Update document with results
                doc.status = "completed"
                doc.chunk_count = result.get("rows_processed", 0)
                doc.file_path = result.get("minio_path", "")
                logger.info(f"Excel file processed successfully: {filename}, rows: {doc.chunk_count}")

            except Exception as e:
                import traceback
                error_detail = f"{str(e)}\n{traceback.format_exc()}"
                logger.error(f"Error processing Excel file {filename}: {error_detail}")
                doc.status = "error"
                doc.error_message = str(e)

            session.add(doc)
            await session.commit()

    # Start background task
    import asyncio
    asyncio.create_task(process_excel_task(doc.id, file_content, file.filename, columns_list))

    return DocumentResponse(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        filename=doc.filename,
        file_type=doc.file_type,
        status=doc.status,
        error_message=doc.error_message,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at
    )


@router.post("/{kb_id}/excel-columns")
async def get_excel_columns(
    kb_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Get column names from an uploaded Excel file without processing it.
    Useful for the frontend to show available columns before uploading.
    """
    import tempfile

    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower().replace(".", "")
    if ext not in ["xlsx", "xls"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: xlsx, xls"
        )

    # Read file content
    file_content = await file.read()

    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
        tmp_file.write(file_content)
        tmp_file_path = tmp_file.name

    try:
        # Get column names
        columns = excel_knowledge_service.get_excel_columns(tmp_file_path)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reading Excel file: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.post("/{kb_id}/documents/{doc_id}/reprocess-excel")
async def reprocess_excel_document(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session)
):
    """
    Reprocess an Excel document that failed or needs to be re-processed.
    Reads the file from MinIO and processes it again with stored metadata columns.
    """
    # Verify knowledge base exists
    kb = await session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    # Get document
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.knowledge_base_id != kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this Knowledge Base")

    # Check if it's an Excel file
    if doc.file_type not in ["xlsx", "xls"]:
        raise HTTPException(status_code=400, detail="Only Excel files can be reprocessed with this endpoint")

    # Check if extra_metadata contains excel_columns
    if not doc.extra_metadata or "excel_columns" not in doc.extra_metadata:
        raise HTTPException(
            status_code=400,
            detail="Cannot reprocess: original column metadata not found. Please re-upload the file."
        )

    # Get file from MinIO
    try:
        file_content = minio_service.download_file_content(doc.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file from storage: {str(e)}")

    # Update status to processing
    doc.status = "processing"
    doc.error_message = None
    session.add(doc)
    await session.commit()

    # Process in background
    from app.core.database import async_session_maker

    async def reprocess_excel_task(doc_id: uuid.UUID, content: bytes, filename: str, columns: List[str]):
        async with async_session_maker() as session:
            doc = await session.get(Document, doc_id)
            if not doc:
                return

            try:
                result = await excel_knowledge_service.process_excel_upload(
                    file_content=content,
                    filename=filename,
                    kb_id=str(kb_id),
                    doc_id=str(doc_id),
                    metadata_columns=columns
                )

                doc.status = "completed"
                doc.chunk_count = result.get("rows_processed", 0)
                doc.file_path = result.get("minio_path", "")
                logger.info(f"Excel file reprocessed successfully: {filename}, rows: {doc.chunk_count}")

            except Exception as e:
                import traceback
                error_detail = f"{str(e)}\n{traceback.format_exc()}"
                logger.error(f"Error reprocessing Excel file {filename}: {error_detail}")
                doc.status = "error"
                doc.error_message = str(e)

            session.add(doc)
            await session.commit()

    background_tasks.add_task(
        reprocess_excel_task,
        doc.id,
        file_content,
        doc.filename,
        doc.extra_metadata["excel_columns"]
    )

    return {"message": "Reprocessing started"}
