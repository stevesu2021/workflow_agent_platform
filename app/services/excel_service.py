"""
Excel Knowledge Base Service

This service handles Excel file processing for knowledge base,
integrating with Milvus for vector storage.
"""
import os
import logging
import pandas as pd
import uuid
import re
import json
from typing import List, Dict, Any, Optional
from pathlib import Path

from app.services.vector_service import VectorService, kb_id_to_collection_name
from app.services.minio_service import MinioService

logger = logging.getLogger(__name__)


class ExcelKnowledgeService:
    """
    Service for processing Excel files and storing them in Milvus vector database.
    """

    def __init__(self):
        self.vector_service = VectorService()
        self.minio_service = MinioService()

    def read_excel_file(self, file_path: str) -> Dict[str, List[Any]]:
        """
        Read Excel file and return as dictionary.

        Args:
            file_path: Path to the Excel file

        Returns:
            Dictionary with column names as keys and column data as values
        """
        try:
            df = pd.read_excel(file_path)
            # Convert to dictionary format
            excel_dict = {}
            for column in df.columns:
                excel_dict[column] = df[column].tolist()
            return excel_dict
        except Exception as e:
            logger.error(f"Error reading Excel file {file_path}: {e}")
            raise

    def sanitize_field_name(self, name: str) -> str:
        """
        Sanitize field names for Milvus.
        Milvus field names must:
        - Start with an underscore or letter
        - Only contain letters, numbers, and underscores
        """
        # Replace non-alphanumeric with underscore
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
        
        # If it starts with a digit, prepend an underscore
        if sanitized and sanitized[0].isdigit():
            sanitized = '_' + sanitized
            
        # If it's empty or only underscores (common for all-Chinese names), 
        # use a deterministic hash to ensure the field name is consistent across rows
        if not sanitized.strip('_'):
            import hashlib
            name_hash = hashlib.md5(name.encode()).hexdigest()[:8]
            sanitized = f"field_{name_hash}"
            
        return sanitized

    def process_excel_row(
        self,
        row_data: Dict[str, str],
        metadata_columns: List[str],
        row_index: int,
        doc_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a single Excel row into a format suitable for vector storage.

        Args:
            row_data: Dictionary of column names to values for this row
            metadata_columns: List of column names to include in metadata
            row_index: Index of the row (for reference)

        Returns:
            Dictionary containing text content and metadata
        """
        # Create text representation by combining metadata fields
        # This is what will be embedded for vector search
        # We use original column names here for the text content
        text_parts = []
        for col in metadata_columns:
            if col in row_data:
                value = row_data[col]
                if pd.notna(value) and str(value).strip():
                    text_parts.append(f"{col}: {value}")
        text_content = "\n".join(text_parts)

        # Build full row data for storage
        full_data = {}
        for col, value in row_data.items():
            full_data[col] = str(value) if pd.notna(value) else ""

        # Build metadata with FIXED fields only to ensure stable Milvus schema
        # regardless of Excel column changes.
        result_metadata = {
            "row_index": str(row_index),
            # Store full_data as a JSON string to avoid invalid field names in Milvus
            # and to prevent flattening of nested structures.
            "full_data": json.dumps(full_data, ensure_ascii=False),
            "source_type": "excel"
        }
        if doc_id:
            result_metadata["document_id"] = doc_id

        return {
            "text": text_content,
            "metadata": result_metadata
        }

    async def process_excel_file(
        self,
        file_path: str,
        kb_id: str,
        doc_id: Optional[str] = None,
        metadata_columns: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Process an Excel file and store its vectors in Milvus.

        Args:
            file_path: Path to the Excel file
            kb_id: Knowledge base ID
            metadata_columns: List of column names to use for metadata/embedding.
                            If None, uses all columns.

        Returns:
            Dictionary with processing statistics
        """
        try:
            # Read Excel file
            excel_data = self.read_excel_file(file_path)

            if not excel_data:
                raise ValueError("Excel file is empty")

            # Get all column names
            all_columns = list(excel_data.keys())
            num_rows = len(excel_data[all_columns[0]])

            # Use all columns if metadata_columns not specified
            if metadata_columns is None:
                metadata_columns = all_columns
            else:
                # Validate metadata_columns exist in the file
                metadata_columns = [col for col in metadata_columns if col in all_columns]

            if not metadata_columns:
                raise ValueError("No valid metadata columns found")

            logger.info(f"Processing Excel file with {num_rows} rows and {len(all_columns)} columns")
            logger.info(f"Using metadata columns: {metadata_columns}")

            # Prepare data for vector storage
            texts = []
            metadatas = []
            ids = []

            for i in range(num_rows):
                # Build row data dictionary
                row_data = {}
                for col in all_columns:
                    value = excel_data[col][i]
                    row_data[col] = str(value) if pd.notna(value) else ""

                # Process row with document_id
                processed = self.process_excel_row(row_data, metadata_columns, i, doc_id)

                texts.append(processed["text"])
                metadatas.append(processed["metadata"])
                ids.append(f"row_{i}_{uuid.uuid4().hex[:8]}")

            # Get collection name for this knowledge base
            collection_name = kb_id_to_collection_name(kb_id)

            # Add to Milvus
            logger.info(f"Adding {len(texts)} vectors to Milvus collection: {collection_name}")
            try:
                await self.vector_service.add_texts(
                    collection_name=collection_name,
                    texts=texts,
                    metadatas=metadatas,
                    ids=ids
                )
            except Exception as e:
                # If we get a schema mismatch or alignment error, it's likely due to 
                # a change in the Excel structure from a previous upload.
                # In this case, we drop the collection and retry to recreate with new schema.
                error_msg = str(e)
                if "DataNotMatchException" in error_msg or "misaligned" in error_msg or "match with schema" in error_msg:
                    logger.warning(f"Schema mismatch for collection {collection_name}, dropping and retrying: {e}")
                    await self.vector_service.delete_collection(collection_name)
                    # Retry once
                    await self.vector_service.add_texts(
                        collection_name=collection_name,
                        texts=texts,
                        metadatas=metadatas,
                        ids=ids
                    )
                else:
                    raise

            return {
                "status": "success",
                "rows_processed": num_rows,
                "columns": all_columns,
                "metadata_columns": metadata_columns,
                "collection_name": collection_name
            }

        except Exception as e:
            logger.error(f"Error processing Excel file: {e}")
            raise

    async def process_excel_upload(
        self,
        file_content: bytes,
        filename: str,
        kb_id: str,
        doc_id: Optional[str] = None,
        metadata_columns: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Process an uploaded Excel file.

        Args:
            file_content: Binary content of the Excel file
            filename: Original filename
            kb_id: Knowledge base ID
            metadata_columns: List of column names to use for metadata/embedding

        Returns:
            Dictionary with processing results
        """
        import tempfile
        import os

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
            tmp_file.write(file_content)
            tmp_file_path = tmp_file.name

        try:
            # First, save original file to MinIO
            object_name = f"knowledge_bases/{kb_id}/{filename}"
            self.minio_service.upload_file(
                file_path=tmp_file_path,
                object_name=object_name
            )

            # Process Excel file
            result = await self.process_excel_file(
                file_path=tmp_file_path,
                kb_id=kb_id,
                doc_id=doc_id,
                metadata_columns=metadata_columns
            )

            result["filename"] = filename
            result["minio_path"] = object_name

            return result

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

    def get_excel_columns(self, file_path: str) -> List[str]:
        """
        Get column names from an Excel file.

        Args:
            file_path: Path to the Excel file

        Returns:
            List of column names
        """
        try:
            df = pd.read_excel(file_path)
            return list(df.columns)
        except Exception as e:
            logger.error(f"Error reading Excel columns: {e}")
            raise


# Singleton instance
excel_knowledge_service = ExcelKnowledgeService()
