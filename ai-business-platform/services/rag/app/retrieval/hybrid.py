import time
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy.orm import Session

from app.core.config import settings
from app.embeddings.bge_m3 import embedding_service
from app.embeddings.embedder import BaseEmbeddingService
from app.retrieval.fts import fts_search
from app.retrieval.reranker import CrossEncoderReranker, reranker_service
from app.retrieval.rrf import compute_rrf
from app.retrieval.vector import vector_search


def hybrid_search(
    query: str,
    tenant_id: str,
    query_embedding: Optional[List[float]] = None,
    top_k: Optional[int] = None,
    candidate_k: Optional[int] = None,
    collection_id: Optional[str] = None,
    document_id: Optional[str] = None,
    rrf_k: Optional[int] = None,
    rerank: bool = True,
    return_latencies: bool = False,
    embedder: Optional[BaseEmbeddingService] = None,
    reranker: Optional[CrossEncoderReranker] = None,
    db: Optional[Session] = None,
) -> Union[List[Dict[str, Any]], Tuple[List[Dict[str, Any]], Dict[str, float]]]:
    """
    Complete hybrid retrieval pipeline:
    Query -> Embed -> (Vector Search || FTS Search) -> RRF Fusion (top 20) -> CrossEncoder Rerank (top 5).
    Returns results, or (results, latency_breakdown_ms) when return_latencies=True.
    """
    total_start = time.perf_counter()
    latencies: Dict[str, float] = {}

    k = top_k or settings.default_top_k
    cand_k = candidate_k or settings.default_candidate_k
    r_k = rrf_k or settings.rrf_k

    emb_svc = embedder or embedding_service
    rerank_svc = reranker or reranker_service

    # 1. Embedding generation (if not already provided)
    t0 = time.perf_counter()
    if query_embedding is None:
        q_emb = emb_svc.embed(query)
    else:
        q_emb = query_embedding
    latencies["embedding_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # 2. Vector Search (pgvector)
    t0 = time.perf_counter()
    vector_results = vector_search(
        query_embedding=q_emb,
        tenant_id=tenant_id,
        top_k=cand_k,
        collection_id=collection_id,
        document_id=document_id,
        db=db,
    )
    latencies["vector_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # 3. Full-Text Search (PostgreSQL FTS)
    t0 = time.perf_counter()
    fts_results = fts_search(
        query=query,
        tenant_id=tenant_id,
        top_k=cand_k,
        collection_id=collection_id,
        document_id=document_id,
        db=db,
    )
    latencies["fts_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # 4. RRF Fusion
    t0 = time.perf_counter()
    rrf_candidates = compute_rrf(
        vector_results=vector_results,
        fts_results=fts_results,
        rrf_k=r_k,
        candidate_k=cand_k,
    )
    latencies["rrf_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # 5. Cross-Encoder Reranking
    t0 = time.perf_counter()
    if rerank and rrf_candidates:
        final_results = rerank_svc.rerank(
            query=query,
            candidates=rrf_candidates,
            top_k=k,
        )
    else:
        for c in rrf_candidates:
            c.setdefault("rerank_score", None)
        final_results = rrf_candidates[:k]
    latencies["rerank_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    latencies["total_retrieval_ms"] = round((time.perf_counter() - total_start) * 1000, 2)

    if return_latencies:
        return final_results, latencies
    return final_results
