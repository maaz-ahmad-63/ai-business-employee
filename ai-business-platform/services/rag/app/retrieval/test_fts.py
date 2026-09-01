from app.retrieval.fts import fts_search


tenant_id = "650cf5a7-1cf4-4513-90df-df3bf86ef9b8"

results = fts_search(
    query="computer science student",
    tenant_id=tenant_id,
    top_k=5,
)

for result in results:
    print("\n--- FTS RESULT ---")
    print("Score:", result["score"])
    print("Content:", result["content"])
