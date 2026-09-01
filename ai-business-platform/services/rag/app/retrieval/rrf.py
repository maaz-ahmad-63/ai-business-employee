from typing import Any, Dict, List, Optional

from app.core.config import settings


def compute_rrf(
    vector_results: List[Dict[str, Any]],
    fts_results: List[Dict[str, Any]],
    rrf_k: Optional[int] = None,
    candidate_k: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Reciprocal Rank Fusion (RRF) combining vector search and FTS keyword search.

    Formula:
        RRF_score = (1 / (k + vector_rank) if in vector else 0) +
                    (1 / (k + fts_rank) if in FTS else 0)
    """
    k = rrf_k if rrf_k is not None else settings.rrf_k
    candidates: Dict[str, Dict[str, Any]] = {}

    # Process vector search results
    for result in vector_results:
        chunk_id = str(result["id"])
        rank = result.get("vector_rank", 1)

        candidates[chunk_id] = {
            "id": chunk_id,
            "document_id": str(result["document_id"]),
            "chunk_index": result.get("chunk_index", 0),
            "content": result["content"],
            "metadata": dict(result.get("metadata") or {}),
            "vector_score": float(result.get("vector_score", 0.0)),
            "vector_rank": rank,
            "keyword_score": None,
            "fts_rank": None,
            "rrf_score": 1.0 / (k + rank),
        }

    # Process FTS search results
    for result in fts_results:
        chunk_id = str(result["id"])
        rank = result.get("fts_rank", 1)

        if chunk_id in candidates:
            # Chunk found in both vector and FTS
            candidates[chunk_id]["keyword_score"] = float(result.get("keyword_score", 0.0))
            candidates[chunk_id]["fts_rank"] = rank
            candidates[chunk_id]["rrf_score"] += 1.0 / (k + rank)
        else:
            # Chunk found only in FTS
            candidates[chunk_id] = {
                "id": chunk_id,
                "document_id": str(result["document_id"]),
                "chunk_index": result.get("chunk_index", 0),
                "content": result["content"],
                "metadata": dict(result.get("metadata") or {}),
                "vector_score": None,
                "vector_rank": None,
                "keyword_score": float(result.get("keyword_score", 0.0)),
                "fts_rank": rank,
                "rrf_score": 1.0 / (k + rank),
            }

    # Sort descending by rrf_score
    ranked = sorted(
        candidates.values(),
        key=lambda x: x["rrf_score"],
        reverse=True,
    )

    if candidate_k is not None:
        return ranked[:candidate_k]

    return ranked
