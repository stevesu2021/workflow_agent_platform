#encoding=utf-8

import torch
from torch import Tensor
from transformers import AutoTokenizer, AutoModel

MODEL_NAME = "/home/steve/models/Qwen3-Embedding-0.6B/"

class EmbeddingModel:

    def __init__(self, model_name=MODEL_NAME):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.load_embedding_model()
    
    def load_embedding_model(self):
        """Load the Qwen embedding model"""
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModel.from_pretrained(self.model_name)
    
    def get_embedding(self, text):
        """
        Generate embedding for a given text
        
        Args:
            text (str): Input text to embed
            
        Returns:
            np.array: Embedding vector
        """
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = self.model(**inputs)
            # Use the CLS token embedding (first token) as the sentence embedding
            #embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy().flatten()
            embedding = EmbeddingModel.last_token_pool(outputs.last_hidden_state, inputs['attention_mask'])
        return embedding

    @staticmethod
    def last_token_pool(last_hidden_states: Tensor,
                    attention_mask: Tensor) -> Tensor:
        left_padding = (attention_mask[:, -1].sum() == attention_mask.shape[0])
        if left_padding:
            return last_hidden_states[:, -1]
        else:
            sequence_lengths = attention_mask.sum(dim=1) - 1
            batch_size = last_hidden_states.shape[0]
            return last_hidden_states[torch.arange(batch_size, device=last_hidden_states.device), sequence_lengths]


if __name__ == "__main__":
    obj = EmbeddingModel()
    embed1 = obj.get_embedding("系统名称: 供应商信用监控 系统编号: SYS-014")
    embed2 = obj.get_embedding("系统编号: SYS-014")
    import numpy as np
    similarity = np.dot(embed1, embed2.T) / (
        np.linalg.norm(embed1) * np.linalg.norm(embed2)
    )
    print(f"similar:{similarity}")