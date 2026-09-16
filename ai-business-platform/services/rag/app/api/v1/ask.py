import logging
import time
from fastapi import APIRouter, HTTPException, status

from app.analytics.mongo_logger import analytics_logger
from app.core.config import settings
from app.llm.providers.factory import get_llm_provider
from app.retrieval.hybrid import hybrid_search
from app.retrieval.prompts import (
    RAG_SYSTEM_PROMPT,
    build_context_and_citations,
    build_rag_user_prompt,
)
from app.schemas.rag import AskRequest, AskResponse, CitationSource

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ask", response_model=AskResponse, status_code=status.HTTP_200_OK)
def ask_question(request: AskRequest):
    """
    Complete RAG Answer Pipeline:
    Retrieve context chunks -> Format indexed citations -> Synthesize answer via pluggable LLM.
    """
    t_start = time.perf_counter()

    try:
        # 1. Retrieve top context chunks
        chunks, latencies = hybrid_search(
            query=request.query,
            tenant_id=request.tenant_id,
            top_k=request.top_k,
            collection_id=request.collection_id,
            document_id=request.document_id,
            rerank=True,
            return_latencies=True,
        )

        # 2. Build context and citation sources
        formatted_context, raw_sources = build_context_and_citations(chunks)
        citation_sources = [
            CitationSource(
                source_id=s["source_id"],
                chunk_id=s["chunk_id"],
                document_id=s["document_id"],
                filename=s.get("filename"),
                page=s.get("page"),
                content=s["content"],
                metadata=s.get("metadata", {}),
            )
            for s in raw_sources
        ]

        # 3. Obtain LLM Provider
        llm = get_llm_provider(
            provider_name=request.llm_provider,
            api_key=request.api_key,
            model=request.llm_model,
        )

        answer = ""
        llm_metadata: dict = {}
        token_usage: dict = {}

        if llm is not None:
            # Generate answer using LLM
            prompt = build_rag_user_prompt(
                query=request.query,
                formatted_context=formatted_context,
            )
            t_llm = time.perf_counter()
            llm_response = llm.generate(
                prompt=prompt,
                system_prompt=RAG_SYSTEM_PROMPT,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )
            latencies["llm_ms"] = round((time.perf_counter() - t_llm) * 1000, 2)
            answer = llm_response.content
            token_usage = llm_response.token_usage
            llm_metadata = {
                "provider": llm_response.provider,
                "model": llm_response.model,
                "token_usage": token_usage,
            }
        else:
            # Fallback when no LLM provider is configured
            latencies["llm_ms"] = 0.0
            if chunks:
                answer = (
                    f"Retrieved {len(chunks)} relevant context chunks from documents. "
                    f"To generate a synthesized AI answer, configure LLM_PROVIDER in the environment."
                )
            else:
                answer = "No relevant context documents were found for your query in the database."
            llm_metadata = {
                "provider": "none",
                "model": "none",
                "note": "No LLM provider configured. Set LLM_PROVIDER (e.g. openai, anthropic, gemini, ollama, mock).",
            }

        total_ms = round((time.perf_counter() - t_start) * 1000, 2)
        latencies["total_ms"] = total_ms

        # Summary retrieval scores for the top chunk
        retrieval_summary: dict = {}
        if chunks:
            top_chunk = chunks[0]
            retrieval_summary = {
                "top_chunk_id": str(top_chunk.get("id")),
                "vector_score": top_chunk.get("vector_score"),
                "keyword_score": top_chunk.get("keyword_score"),
                "rrf_score": top_chunk.get("rrf_score"),
                "rerank_score": top_chunk.get("rerank_score"),
                "chunks_retrieved": len(chunks),
            }

        # 4. Log to MongoDB analytics (non-blocking)
        analytics_logger.log_ask(
            tenant_id=request.tenant_id,
            query=request.query,
            answer=answer,
            sources=raw_sources,
            latencies=latencies,
            llm_provider=llm_metadata.get("provider"),
            llm_model=llm_metadata.get("model"),
            token_usage=token_usage,
            collection_id=request.collection_id,
            document_id=request.document_id,
        )

        return AskResponse(
            answer=answer,
            sources=citation_sources,
            retrieval=retrieval_summary,
            latency_ms=latencies,
            llm=llm_metadata,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error during ask for tenant {request.tenant_id}: {exc}")
        analytics_logger.log_ask(
            tenant_id=request.tenant_id,
            query=request.query,
            answer="",
            sources=[],
            latencies={},
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while synthesizing the RAG answer.",
        )
