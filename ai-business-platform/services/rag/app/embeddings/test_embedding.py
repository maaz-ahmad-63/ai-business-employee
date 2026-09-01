from app.embeddings.bge_m3 import embedding_service


text = "Maaz is a computer science student."

embedding = embedding_service.embed(text)

print("Embedding dimension:", len(embedding))
print("First 5 values:", embedding[:5])
