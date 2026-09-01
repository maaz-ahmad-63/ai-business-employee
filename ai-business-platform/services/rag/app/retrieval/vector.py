from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def vector_search(
    query_embedding: List[float],
    tenant_id: str,
    top_k: int = 20,
    collection_id: Optional[str] = None,
    document_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """
    Perform PostgreSQL/pgvector cosine similarity search.
    Enforces strict tenant isolation and optional collection/document filtering.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        where_clauses = [
            "c.tenant_id = :tenant_id",
            "c.embedding IS NOT NULL",
        ]
        params: Dict[str, Any] = {
            "tenant_id": str(tenant_id),
            "embedding": str(query_embedding),
            "top_k": top_k,
        }

        join_clause = ""
        if collection_id:
            join_clause = "JOIN documents d ON c.document_id = d.id AND d.tenant_id = :tenant_id"
            where_clauses.append("d.collection_id = :collection_id")
            params["collection_id"] = str(collection_id)

        if document_id:
            where_clauses.append("c.document_id = :document_id")
            params["document_id"] = str(document_id)

        where_sql = " AND ".join(where_clauses)

        query = text(f"""
            SELECT
                c.id,
                c.document_id,
                c.chunk_index,
                c.content,
                c.metadata,
                1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
            FROM chunks c
            {join_clause}
            WHERE {where_sql}
            ORDER BY c.embedding <=> CAST(:embedding AS vector) ASC
            LIMIT :top_k
        """)

        result = db.execute(query, params)
        rows = result.mappings().all()

        results: List[Dict[str, Any]] = []
        for rank, row in enumerate(rows, start=1):
            score_val = float(row["score"]) if row["score"] is not None else 0.0
            results.append({
                "id": str(row["id"]),
                "document_id": str(row["document_id"]),
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "metadata": dict(row["metadata"] or {}),
                "score": score_val,
                "vector_score": score_val,
                "vector_rank": rank,
            })

        return results

    finally:
        if should_close:
            db.close()
