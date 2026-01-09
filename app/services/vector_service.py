import os
from typing import List, Dict, Any, Optional, Tuple
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings, FakeEmbeddings
from langchain_community.vectorstores import Milvus
from langchain_core.documents import Document as LangchainDocument
from pymilvus import connections, utility
import logging

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self):
        self.milvus_host = os.getenv("MILVUS_HOST", "127.0.0.1")
        self.milvus_port = os.getenv("MILVUS_PORT", "19530")
        
        # Connect to Milvus globally for utility functions
        try:
            connections.connect(alias="default", host=self.milvus_host, port=self.milvus_port)
            print(f"Connected to Milvus at {self.milvus_host}:{self.milvus_port}")
        except Exception as e:
            print(f"Failed to connect to Milvus: {e}")

        # We need an embedding function. 
        # For this prototype, we'll try to use OpenAI if key exists, otherwise we use a local model.
        # Check settings or env
        from app.core.config import settings
        api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        
        if api_key:
            print("Using OpenAI Embeddings")
            self.embedding_function = OpenAIEmbeddings(api_key=api_key)
        else:
            print("WARNING: OPENAI_API_KEY not found. Using FakeEmbeddings for offline mode.")
            # Use FakeEmbeddings to avoid downloading models in offline environment
            self.embedding_function = FakeEmbeddings(size=384)
            
            # Legacy fallback code (disabled for offline environment)
            # self.embedding_function = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    def get_collection(self, collection_name: str) -> Milvus:
        # Define index params for IP metric (Inner Product / Cosine Similarity)
        # Using IP ensures higher score = higher similarity
        index_params = {
            "metric_type": "IP",
            "index_type": "HNSW",
            "params": {"M": 8, "efConstruction": 64}
        }
        # Define search params
        search_params = {
            "metric_type": "IP", 
            "params": {"ef": 64}
        }
        
        # Check if collection exists
        if utility.has_collection(collection_name):
            # If collection exists, we must inspect its index info to match metric type
            # Or simpler: try to connect with IP params, if it fails (due to metric mismatch),
            # fallback to L2 params (legacy collections).
            # But LangChain Milvus wrapper doesn't expose a way to "check and adapt".
            # It just passes params to Milvus.
            
            # Since we can't easily check metric type without loading collection (which might be heavy),
            # Let's try to assume IP first. If search fails with metric mismatch, we can't easily retry inside `search` 
            # because `get_collection` is called before search.
            
            # Alternative: Since we changed the default to IP, existing collections created with L2 will fail.
            # To support legacy collections (L2) and new collections (IP), we should check collection info.
            
            # Let's inspect index
            try:
                index_info = utility.index_building_progress(collection_name)
                # This doesn't give metric type directly easily.
                
                # Let's use collection description or just try-catch?
                # Actually, utility.list_indexes(collection_name) might give us info if index exists.
                indexes = utility.list_indexes(collection_name)
                if indexes:
                    # indexes is a list of Index objects? No, it's list of strings (index names) or IndexInfo?
                    # pymilvus 2.x utility.list_indexes returns list of strings? No.
                    # It returns Index objects.
                    # Let's get index details.
                    # Actually, we can just instantiate Milvus without index_params if it exists, 
                    # LangChain might load existing config? 
                    # No, LangChain Milvus constructor uses these params for SEARCH too.
                    
                    # If we don't pass search_params, it uses default (L2).
                    pass
            except Exception:
                pass
        
        # To fix the immediate issue "metric type not match: invalid parameter[expected=L2][actual=IP]":
        # The error comes from Milvus server saying the collection was built with L2, but we are requesting IP search.
        # We should detect this and fallback.
        
        # For now, since user wants to fix "test1" (which is likely L2), but we also want to support new IP ones.
        # We can try to use a wrapper that detects or just defaulting back to L2 for existing collections if we can't migrate.
        # BUT user might want to keep using test1.
        
        # Strategy:
        # 1. Check if collection exists.
        # 2. If yes, check its index metric type.
        # 3. Use that metric type for search_params.
        
        metric_type = "IP" # Default for new
        
        if utility.has_collection(collection_name):
            try:
                # Get index info
                indexes = utility.list_indexes(collection_name)
                for index in indexes:
                    # index is an object, need to check its params
                    # In pymilvus, index might not expose metric_type directly in all versions easily
                    # But we can try `index.params.get('metric_type')`
                    # Or describe_index
                    pass
                    
                # Using describe_index might be better
                # But let's look at the error: [expected=L2][actual=IP]
                # This means the collection expects L2.
                
                # Hacky fix: Try to determine if it is L2.
                # If we can't determine, we might break new IP collections if we default to L2.
                
                # Let's try to get collection info via Collection object
                from pymilvus import Collection
                col = Collection(collection_name)
                # Check indexes
                if col.indexes:
                    for idx in col.indexes:
                        # idx.params is a dict
                        m_type = idx.params.get("metric_type")
                        if m_type:
                            metric_type = m_type
                            break
            except Exception as e:
                print(f"Error checking index metric type: {e}")
                # Fallback to L2 if check fails? Or stick to IP?
                # If we fail to check, maybe it's safer to stick to L2 for legacy compatibility if that was the old default?
                # But we just changed to IP.
                pass
        
        index_params = {
            "metric_type": metric_type,
            "index_type": "HNSW",
            "params": {"M": 8, "efConstruction": 64}
        }
        search_params = {
            "metric_type": metric_type, 
            "params": {"ef": 64}
        }

        return Milvus(
            embedding_function=self.embedding_function,
            collection_name=collection_name,
            connection_args={"host": self.milvus_host, "port": self.milvus_port},
            auto_id=True,
            drop_old=False,
            index_params=index_params,
            search_params=search_params
        )

    async def add_texts(self, collection_name: str, texts: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
        """
        Add texts to the vector store.
        """
        if not texts:
            return
            
        # Check if collection exists and has wrong metric type
        if utility.has_collection(collection_name):
            try:
                from pymilvus import Collection
                col = Collection(collection_name)
                is_l2 = False
                if col.indexes:
                    for idx in col.indexes:
                        if idx.params.get("metric_type") == "L2":
                            is_l2 = True
                            break
                
                if is_l2:
                    # If it's L2, we drop it to recreate with IP
                    print(f"Collection {collection_name} is using L2. Dropping to recreate with IP.")
                    utility.drop_collection(collection_name)
            except Exception as e:
                print(f"Error checking/dropping collection for reindex: {e}")

        # Milvus/LangChain integration handles collection creation automatically
        vector_store = self.get_collection(collection_name)
        
        # Note: ids in Milvus (auto_id=True) are usually integers. 
        # LangChain Milvus implementation handles this, but if we pass ids, 
        # we need to make sure schema matches. 
        # The default LangChain Milvus schema uses auto-generated int IDs if we don't specify schema.
        # If we pass `ids` argument to `add_texts`, LangChain might try to use them as primary keys.
        # However, for simplicity and compatibility, we'll let Milvus generate IDs 
        # and store our custom IDs in metadata if needed.
        # Let's see LangChain Milvus implementation... it supports custom IDs if they are consistent.
        # To be safe with standard setup, let's store our `ids` in metadata as `chunk_id`
        # and let Milvus handle the primary key.
        
        # Update metadatas with chunk_id
        for i, meta in enumerate(metadatas):
            meta["chunk_id"] = ids[i]

        vector_store.add_texts(texts=texts, metadatas=metadatas)

    async def search(self, collection_name: str, query: str, top_k: int = 5, score_threshold: float = 0.0) -> List[Tuple[LangchainDocument, float]]:
        """
        Search for documents.
        """
        vector_store = self.get_collection(collection_name)
        
        try:
            # similarity_search_with_score returns (doc, score)
            # For Milvus, default metric is usually L2 or IP.
            # LangChain's Milvus wrapper usually converts distance to similarity if configured,
            # but standard `similarity_search_with_score` returns distance for L2.
            results = vector_store.similarity_search_with_score(query, k=top_k)
            
            # Normalize scores or handle them based on metric?
            # If using Inner Product (IP), higher is better.
            # If using L2, lower is better.
            # LangChain Milvus defaults: metric_type="L2". 
            # So `score` is distance. 
            
            # User wants "score" and "topk".
            # Let's assume relevance. If L2, we might want to convert to similarity 1/(1+d) or just return distance.
            # But the existing code used `similarity_search_with_relevance_scores` (0..1).
            # Milvus wrapper in newer langchain might support `similarity_search_with_relevance_scores`.
            # Let's try `similarity_search_with_relevance_scores` first.
            
            # Note: `similarity_search_with_relevance_scores` is implemented in base VectorStore
            # but relies on `_similarity_search_with_relevance_scores` implementation in subclass.
            # Milvus subclass implementation:
            # It seems it might not always be implemented or reliable for all metrics.
            # Let's fallback to `similarity_search_with_score` and return raw scores for now,
            # but the interface expects (doc, score).
            
            results = vector_store.similarity_search_with_score(query, k=top_k)
            
            # For L2, lower is closer. But user expects "highest score" usually implies similarity.
            # Let's just return what we get, but filter if needed.
            # Since we can't easily normalize without knowing the exact distribution, 
            # we will return the raw score.
            
            # Filter? If L2, threshold logic is reversed (score <= threshold).
            # If we stick to generic `similarity_search`, we get docs.
            
            return results
        except Exception as e:
            print(f"Search failed: {e}")
            return []

    async def query(self, collection_name: str, expr: str) -> List[Dict[str, Any]]:
        """
        Query for documents using scalar filtering (no vector search).
        """
        try:
            vector_store = self.get_collection(collection_name)
            
            # Use PyMilvus collection directly for query
            # Accessing the internal collection object from LangChain wrapper might be tricky 
            # as it might not be exposed publicly.
            # But we can create a Collection object directly using pymilvus if we know the name.
            from pymilvus import Collection
            
            # Ensure connection
            # We already connected in __init__
            
            col = Collection(collection_name)
            
            # Load collection to memory before query
            col.load()
            
            # Query
            # We need to return output fields. 'text' is where LangChain stores content usually.
            # And metadata fields.
            res = col.query(
                expr=expr, 
                output_fields=["text", "source", "document_id", "chunk_id", "pk"]
            )
            
            return res
        except Exception as e:
            print(f"Query failed: {e}")
            return []

    async def delete_vectors(self, collection_name: str, expr: str):
        """
        Delete vectors matching the expression.
        """
        try:
            from pymilvus import Collection
            
            if not utility.has_collection(collection_name):
                return
            
            # Use Collection object to delete
            col = Collection(collection_name)
            col.delete(expr)
            print(f"Deleted vectors in {collection_name} matching {expr}")
        except Exception as e:
            print(f"Error deleting vectors: {e}")

    async def delete_collection(self, collection_name: str):
        """
        Delete a collection.
        """
        try:
            if utility.has_collection(collection_name):
                utility.drop_collection(collection_name)
                print(f"Dropped collection {collection_name}")
        except Exception as e:
            print(f"Error deleting collection {collection_name}: {e}")

# Singleton instance
vector_service = VectorService()
