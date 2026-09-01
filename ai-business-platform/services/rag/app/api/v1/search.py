import logging
import time
from fastapi import APIRouter, HTTPException, status

from app.analytics.mongo_logger import analytics_logger
from app.retrieval.hybrid import hybrid_search
from app.schemas.rag import SearchRequest, SearchResponse, SearchResultChunk

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/search", response_model=SearchResponse, status_code=status.HTTP_200_OK)
def search_chunks(request: SearchRequest):
    """
    Perform hybrid vector + full-text search with RRF fusion and CrossEncoder reranking.
    Enforces multi-tenant isolation.
    """
    t_start = time.perf_counter()

    try:
        results, latencies = hybrid_search(
            query=request.query,
            tenant_id=request.tenant_id,
            top_k=request.top_k,
            candidate_k=request.candidate_k,
            collection_id=request.collection_id,
            document_id=request.document_id,
            rerank=request.rerank,
            return_latencies=True,
        )

        formatted_results = [
            SearchResultChunk(
                chunk_id=str(r["id"]),
                document_id=str(r["document_id"]),
                chunk_index=r.get("chunk_index", 0),
                content=r["content"],
                vector_score=r.get("vector_score"),
                keyword_score=r.get("keyword_score"),
                rrf_score=r.get("rrf_score"),
                rerank_score=r.get("rerank_score"),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ]

        total_ms = round((time.perf_counter() - t_start) * 1000, 2)
        latencies["took_ms"] = total_ms

        # Log search analytics (non-blocking)
        analytics_logger.log_retrieval(
            tenant_id=request.tenant_id,
            query=request.query,
            top_k=request.top_k,
            candidate_count=request.candidate_k,
            results=results,
            latencies=latencies,
            collection_id=request.collection_id,
            document_id=request.document_id,
        )

        return SearchResponse(
            found=len(formatted_results) > 0,
            results=formatted_results,
            query=request.query,
            top_k=request.top_k,
            took_ms=total_ms,
            latencies=latencies,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error during search for tenant {request.tenant_id}: {exc}")
        analytics_logger.log_retrieval(
            tenant_id=request.tenant_id,
            query=request.query,
            top_k=request.top_k,
            candidate_count=request.candidate_k,
            results=[],
            latencies={},
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the search request.",
        )
