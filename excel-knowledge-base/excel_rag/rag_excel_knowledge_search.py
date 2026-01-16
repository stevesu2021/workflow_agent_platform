import pickle
import numpy as np
import torch
from embedding_model import EmbeddingModel
from collections import defaultdict


class ExcelKnowledgeSearch:
    def __init__(self, knowledge_base_file, knowledge_multi_file, model_name="/home/steve/models/Qwen3-Embedding-0.6B/"):
        """
        Initialize the search engine with knowledge base file
        
        Args:
            knowledge_base_file (str): Path to the knowledge base file
            model_name (str): Name of the embedding model
        """
        self.knowledge_base_file = knowledge_base_file
        self.knowledge_multi_file = knowledge_multi_file
        self.embedding_model = EmbeddingModel()
        self.knowledge_base = None
        self.knowledge_multi = None
        self.load_knowledge_base()
        self.load_knowledge_multi()
        
    def load_knowledge_base(self):
        """Load the knowledge base from file"""
        with open(self.knowledge_base_file, 'rb') as f:
            self.knowledge_base = pickle.load(f)

    def load_knowledge_multi(self):
        """Load the knowledge multi from file"""
        with open(self.knowledge_multi_file, 'rb') as f:
            self.knowledge_multi = pickle.load(f)


    def common_search(self, single_knowledge, query, top_k=20):
        """
        Search the knowledge base for relevant entries
        
        Args:
            query (str): Search query
            top_k (int): Number of top results to return
            
        Returns:
            list: Top K most relevant entries
        """
        # Generate embedding for query
        query_embedding = self.embedding_model.get_embedding(query)
        
        # Calculate similarities with all entries in knowledge base
        similarities = []
        for entry in single_knowledge:
            # Calculate cosine similarity
            kb_embedding = entry['embedding']
            similarity = np.dot(query_embedding, kb_embedding.T) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(kb_embedding)
            )
            similarities.append(similarity[0][0])
            
        # Get top-k most similar entries
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        # Return results
        results = []
        for idx in top_indices:
            results.append({
                'similarity': similarities[idx],
                'data': self.knowledge_base[idx]['data'],
                'metadata': self.knowledge_base[idx]['metadata'],
                'uuid' : self.knowledge_base[idx]['uuid']
            })
            
        return results


    def search(self, tobe_included, query, top_k=5):
        results = []
        for txt in tobe_included:
            if txt in query:
                result1 = self.common_search(self.knowledge_multi[txt], query, top_k=top_k)
                results.extend(result1)
        result1 = self.common_search(self.knowledge_base, query, top_k=top_k)
        results.extend(result1)
        #结果合并
        groups = defaultdict(list)
        for item in results:
            groups[item['uuid']].append(item)
    
        merged = []
        for uuid_key, items in groups.items():
            # 假设同一 uuid 的 data 和 metadata 是相同的，取第一个即可
            avg_similarity = sum(item['similarity'] for item in items) / len(items)
            merged.append({
                'similarity': avg_similarity,
                'data': items[0]['data'],
                'metadata': items[0]['metadata'],
                'uuid': uuid_key
            })
        merged.sort(key=lambda x: x['similarity'], reverse=True)
        return merged[:top_k]

# Example usage
if __name__ == '__main__':
    # Initialize search engine
    search_engine = ExcelKnowledgeSearch('knowledge_base.pkl', 'knowledge_multi.pkl')
    tobe_included = ["系统名称", "系统编号"]
    # Query the search engine
    query = "系统编号: SYS-014"
    results = search_engine.search(tobe_included, query, top_k=5)
    
    # Print results
    for result in results:
        print(f"Similarity: {result['similarity']:.4f}, Data: {result['data']}")
