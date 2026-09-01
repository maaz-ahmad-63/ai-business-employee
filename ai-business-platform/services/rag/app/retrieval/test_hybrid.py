from app.embeddings.bge_m3 import embedding_service
from app.retrieval.hybrid import hybrid_search


tenant_id = "650cf5a7-1cf4-4513-90df-df3bf86ef9b8"

query = "computer science student"

query_embedding = embedding_service.embed(query)

results = hybrid_search(
    query=query,
    query_embedding=query_embedding,
    tenant_id=tenant_id,
    top_k=5,
)

for result in results:
    print("\n--- HYBRID RESULT ---")
    print("Content:", result["content"])
    print("Vector rank:", result["vector_rank"])
    print("FTS rank:", result["fts_rank"])
    print("RRF score:", result["rrf_score"])
