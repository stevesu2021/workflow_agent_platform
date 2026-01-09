from langchain_community.embeddings import FakeEmbeddings
print("FakeEmbeddings imported successfully")
fe = FakeEmbeddings(size=384)
print("FakeEmbeddings instantiated")
emb = fe.embed_query("test")
print(f"Embedding generated, len: {len(emb)}")
