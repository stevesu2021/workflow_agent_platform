import os
import shutil
import uuid
import tempfile
import io
import json
import asyncio
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.knowledge import Document
from app.services.vector_service import vector_service
from app.services.minio_service import minio_service
from app.services.ai_resource_service import AiResourceService
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import docx

class DocumentService:
    def __init__(self):
        pass

    async def save_file(self, file: UploadFile, knowledge_base_id: uuid.UUID) -> str:
        # Use str(knowledge_base_id) to ensure it's a string in path
        object_name = f"{str(knowledge_base_id)}/{file.filename}"
        
        # Get size
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        
        minio_service.upload_stream(
            file.file,
            object_name,
            size,
            content_type=file.content_type or "application/octet-stream"
        )
        
        return object_name

    async def process_document(self, document: Document, session: AsyncSession) -> int:
        """
        Load, split, and index document. Returns chunk count.
        """
        try:
            # 1. Check for PaddleOCR resource
            ai_service = AiResourceService(session)
            ocr_resources = await ai_service.list_resources(type_filter="ocr_paddle", only_enabled=True)
            ocr_resource = ocr_resources[0] if ocr_resources else None

            # 2. Load
            text = await self._load_file_content(document.file_path, document.file_type, ocr_resource)
            
            # Save parsed markdown/text to MinIO
            # We append .md to the original filename to indicate it's the parsed version
            # Use str(knowledge_base_id)
            parsed_object_name = f"{str(document.knowledge_base_id)}/parsed/{document.filename}.md"
            text_bytes = text.encode('utf-8')
            minio_service.upload_stream(
                io.BytesIO(text_bytes),
                parsed_object_name,
                len(text_bytes),
                content_type="text/markdown"
            )

            # 3. Split
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
            )
            # We create documents directly from text
            chunks = splitter.create_documents([text], metadatas=[{"source": document.filename, "document_id": str(document.id)}])
            
            # 4. Index
            if not chunks:
                return 0

            texts = [chunk.page_content for chunk in chunks]
            metadatas = [chunk.metadata for chunk in chunks]
            ids = [f"{document.id}_{i}" for i in range(len(chunks))]
            
            # Milvus collection names can only contain numbers, letters and underscores
            # We must replace hyphens in UUID with underscores
            sanitized_kb_id = str(document.knowledge_base_id).replace("-", "_")
            collection_name = f"kb_{sanitized_kb_id}"
            
            # Delete existing chunks for this document before adding new ones
            # This handles reindexing
            await vector_service.delete_vectors(collection_name, f'document_id == "{str(document.id)}"')
            
            await vector_service.add_texts(collection_name, texts, metadatas, ids)
            
            return len(chunks)
        except Exception as e:
            print(f"Error processing document {document.id}: {e}")
            raise e

    async def get_document_content(self, document: Document) -> str:
        """
        Get document content (parsed markdown or original text).
        """
        # Try to get parsed markdown first
        # Use str() for UUID
        parsed_object_name = f"{str(document.knowledge_base_id)}/parsed/{document.filename}.md"
        
        try:
            response = minio_service.get_object(parsed_object_name)
            try:
                content = response.read().decode('utf-8')
                return content
            finally:
                response.close()
                response.release_conn()
        except Exception:
            # Fallback to original file if text/md
            if document.file_type in ["txt", "md"]:
                try:
                    response = minio_service.get_object(document.file_path)
                    try:
                        content = response.read().decode('utf-8')
                        return content
                    finally:
                        response.close()
                        response.release_conn()
                except Exception:
                    pass
            
            return "Preview not available. Please process the document first or file type not supported for preview."
    async def _load_file_content(self, object_name: str, file_type: str, ocr_resource=None) -> str:
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_type}") as tmp:
            tmp_path = tmp.name
        
        try:
            minio_service.download_file(object_name, tmp_path)
            
            # If OCR resource is available and file is PDF, use OCR
            if ocr_resource and file_type == "pdf":
                try:
                    return await self._run_paddleocr(tmp_path, ocr_resource.endpoint)
                except Exception as e:
                    print(f"OCR failed, falling back to standard loader: {e}")
                    # Fallback to standard loader if OCR fails
            
            if file_type == "pdf":
                loader = PyPDFLoader(tmp_path)
                pages = loader.load()
                return "\n\n".join([p.page_content for p in pages])
            elif file_type == "docx":
                doc = docx.Document(tmp_path)
                return "\n".join([para.text for para in doc.paragraphs])
            elif file_type in ["txt", "md"]:
                with open(tmp_path, "r", encoding="utf-8") as f:
                    return f.read()
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    async def _run_paddleocr(self, file_path: str, endpoint: str) -> str:
        """
        Run PaddleOCR script via subprocess.
        """
        cmd = [
            "conda", "run", "-n", "paddleocr_vlm", "--no-capture-output",
            "python", "scripts/test_paddleocr_connection.py",
            "--server_url", endpoint,
            "--file_path", file_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"OCR Script failed: {stderr.decode()}")
        
        try:
            result = json.loads(stdout.decode())
            if result.get("status") == "success":
                return result.get("markdown", "")
            else:
                raise Exception(result.get("message", "Unknown error"))
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON output from OCR script: {stdout.decode()}")

document_service = DocumentService()
