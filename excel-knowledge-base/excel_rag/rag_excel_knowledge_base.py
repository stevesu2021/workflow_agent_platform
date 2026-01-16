import pandas as pd
import json
import numpy as np

import torch
import pickle
import os
import uuid

from embedding_model import EmbeddingModel

class ExcelKnowledgeBase:
    def __init__(self, excel_file, tobe_included):
        """
        Initialize the knowledge base with excel file and columns to include
        
        Args:
            excel_file (str): Path to the Excel file
            tobe_included (list): List of column names to include in metadata
        """
        self.embedding_model = EmbeddingModel()
        self.excel_file = excel_file
        self.tobe_included = tobe_included
        self.knowledge_multi = {k:[] for k in self.tobe_included}
        self.knowledge_base = []

        
    def read_excel(self):
        """
        Read the Excel file and process it into the required format
        
        Returns:
            dict: A dictionary with column names as keys and column data as values
        """
        # Read Excel file
        df = pd.read_excel(self.excel_file)
        
        # Convert to dictionary format
        excel_dict = {}
        for column in df.columns:
            excel_dict[column] = df[column].tolist()
            
        return excel_dict
    
    def create_knowledge_base(self):
        """Create the knowledge base from Excel data""" 
            
        # Read Excel data
        excel_data = self.read_excel()
        
        # Get all column names
        all_columns = list(excel_data.keys())
        
        # Process each row
        num_rows = len(excel_data[all_columns[0]])  # All columns should have same length
        
        for i in range(num_rows):
            # Create data part (full row as JSON)
            data_part = {}
            for col in all_columns:
                data_part[col] = str(excel_data[col][i]) if not pd.isna(excel_data[col][i]) else ""
            
            data_uuid = uuid.uuid4()
            # Create metadata part (only included columns)
            metadata_part = {}
            for col in self.tobe_included:
                if col in all_columns:
                    metadata_part[col] = str(excel_data[col][i]) if not pd.isna(excel_data[col][i]) else ""
                    
            # Combine metadata fields for embedding
            metadata_text = " ".join([f"{k}: {v}" for k, v in metadata_part.items()])
            
            embedding = self.embedding_model.get_embedding(metadata_text)
                
            # Store in knowledge base
            self.knowledge_base.append({
                'data': data_part,
                'metadata': metadata_part,
                'embedding': embedding,
                'uuid': data_uuid
            })

            print(f"Processed row {i+1}/{num_rows}, txt:[{metadata_text}], embedding:{embedding}")
    
        
    def create_knowledge_multi(self):
        """Create the knowledge base from Excel data""" 
            
        # Read Excel data
        excel_data = self.read_excel()
        
        # Get all column names
        all_columns = list(excel_data.keys())
        
        # Process each row
        num_rows = len(excel_data[all_columns[0]])  # All columns should have same length
        
        for i in range(num_rows):
            # Create data part (full row as JSON)
            data_part = {}
            for col in all_columns:
                data_part[col] = str(excel_data[col][i]) if not pd.isna(excel_data[col][i]) else ""
                
            # Create metadata part (only included columns)
            metadata_part = {}
            for col in self.tobe_included:
                if col in all_columns:
                    metadata_part[col] = str(excel_data[col][i]) if not pd.isna(excel_data[col][i]) else ""
                    metadata_text = f"{col}:{metadata_part[col]}"
                    embedding = self.embedding_model.get_embedding(metadata_text)
                    self.knowledge_multi[col].append({
                        'data': data_part,
                        'metadata': metadata_part,
                        'embedding': embedding
                    })
                    print(f"Processed row {i+1}/{num_rows}, txt:[{metadata_text}], embedding:{embedding}")
            
    def save_knowledge_base(self, output_file="knowledge_base.pkl"):
        """
        Save the knowledge base to a file
        
        Args:
            output_file (str): Path to save the knowledge base file
        """
        with open(output_file, 'wb') as f:
            pickle.dump(self.knowledge_base, f)

    def save_knowledge_multi(self, output_file="knowledge_multi.pkl"):
        """
        Save the knowledge base to a file
        
        Args:
            output_file (str): Path to save the knowledge base file
        """
        with open(output_file, 'wb') as f:
            pickle.dump(self.knowledge_multi, f)

# Example usage
if __name__ == "__main__":
    excel_file = "test.xlsx"
    tobe_included = ["系统名称", "系统编号"]
    
    kb = ExcelKnowledgeBase(excel_file, tobe_included)
    kb.create_knowledge_base()
    kb.save_knowledge_base()
    kb.create_knowledge_multi()
    kb.save_knowledge_multi()
    