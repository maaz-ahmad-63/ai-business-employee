from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def fts_search(
    query: str,
    tenant_id: str,
    top_k: int = 20,
    collection_id: Optional[str] = None,
    document_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """
    Perform PostgreSQL Full Text Search using GIN index.
    Enforces strict tenant isolation and optional collection/document filtering.
    """
    clean_q = query.strip() if query else ""
    if not clean_q:
        return []

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        where_clauses = [
            "c.tenant_id = :tenant_id",
            "to_tsvector('english', c.content) @@ websearch_to_tsquery('english', :query)",
        ]
        params: Dict[str, Any] = {
            "tenant_id": str(tenant_id),
            "query": clean_q,
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

        sql_query = text(f"""
            SELECT
                c.id,
                c.document_id,
                c.chunk_index,
                c.content,
                c.metadata,
                ts_rank_cd(
                    to_tsvector('english', c.content),
                    websearch_to_tsquery('english', :query)
                ) AS score
            FROM chunks c
            {join_clause}
            WHERE {where_sql}
            ORDER BY score DESC
            LIMIT :top_k
        """)

        try:
            result = db.execute(sql_query, params)
            rows = result.mappings().all()
        except Exception:
            # If websearch_to_tsquery fails due to uncommon syntax, fallback to plainto_tsquery
            db.rollback()
            fallback_where = [
                "c.tenant_id = :tenant_id",
                "to_tsvector('english', c.content) @@ plainto_tsquery('english', :query)",
            ]
            if collection_id:
                fallback_where.append("d.collection_id = :collection_id")
            if document_id:
                fallback_where.append("c.document_id = :document_id")

            fallback_sql = text(f"""
                SELECT
                    c.id,
                    c.document_id,
                    c.chunk_index,
                    c.content,
                    c.metadata,
                    ts_rank_cd(
                        to_tsvector('english', c.content),
                        plainto_tsquery('english', :query)
                    ) AS score
                FROM chunks c
                {join_clause}
                WHERE {" AND ".join(fallback_where)}
                ORDER BY score DESC
                LIMIT :top_k
            """)
            result = db.execute(fallback_sql, params)
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
                "keyword_score": score_val,
                "fts_rank": rank,
            })

        return results

    finally:
        if should_close:
            db.close()
