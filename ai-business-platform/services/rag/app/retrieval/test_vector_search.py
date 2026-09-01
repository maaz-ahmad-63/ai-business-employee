from app.embeddings.bge_m3 import embedding_service
from app.retrieval.vector import vector_search


query = "What does Maaz study?"

query_embedding = embedding_service.embed(query)

tenant_id = "650cf5a7-1cf4-4513-90df-df3bf86ef9b8"

results = vector_search(
    query_embedding=query_embedding,
    tenant_id=tenant_id,
    top_k=5,
)

for result in results:
    print("\n--- RESULT ---")
    print("Score:", result["score"])
    print("Content:", result["content"])
