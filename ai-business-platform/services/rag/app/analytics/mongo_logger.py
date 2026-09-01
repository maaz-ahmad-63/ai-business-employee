from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoRAGLogger:
    """Optional, fault-tolerant MongoDB logger for RAG query and ask analytics."""

    def __init__(
        self,
        mongo_url: Optional[str] = None,
        database_name: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        self.mongo_url = mongo_url or settings.mongodb_url
        self.database_name = database_name or settings.mongodb_database
        self.collection_name = collection_name or settings.mongodb_collection
        self._client = None
        self._collection = None

    def _get_collection(self):
        """Lazy-initialize Mongo client if URL is configured."""
        if not self.mongo_url:
            return None

        if self._collection is None:
            try:
                import pymongo

                self._client = pymongo.MongoClient(
                    self.mongo_url,
                    serverSelectionTimeoutMS=2000,
                    connectTimeoutMS=2000,
                )
                db = self._client[self.database_name]
                self._collection = db[self.collection_name]
            except Exception as exc:
                logger.warning(f"Could not connect to MongoDB for RAG analytics: {exc}")
                self._collection = None
        return self._collection

    def log_retrieval(
        self,
        tenant_id: str,
        query: str,
        top_k: int,
        candidate_count: int,
        results: List[Dict[str, Any]],
        latencies: Dict[str, float],
        collection_id: Optional[str] = None,
        document_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> bool:
        """Log a /api/rag/search retrieval request."""
        try:
            coll = self._get_collection()
            if coll is None:
                return False

            chunk_logs = [
                {
                    "chunk_id": str(r.get("id")),
                    "document_id": str(r.get("document_id")),
                    "vector_score": r.get("vector_score"),
                    "keyword_score": r.get("keyword_score"),
                    "rrf_score": r.get("rrf_score"),
                    "rerank_score": r.get("rerank_score"),
                }
                for r in results
            ]

            doc = {
                "type": "search",
                "tenant_id": str(tenant_id),
                "collection_id": str(collection_id) if collection_id else None,
                "document_id": str(document_id) if document_id else None,
                "query": query,
                "top_k": top_k,
                "candidate_count": candidate_count,
                "result_count": len(results),
                "chunks": chunk_logs,
                "latencies_ms": latencies,
                "embedding_model": settings.embedding_model,
                "reranker_model": settings.reranker_model if settings.reranker_enabled else None,
                "error": error,
                "timestamp": datetime.now(timezone.utc),
            }

            coll.insert_one(doc)
            return True

        except Exception as exc:
            logger.warning(f"MongoDB logging failed (retrieval proceeding safely): {exc}")
            return False

    def log_ask(
        self,
        tenant_id: str,
        query: str,
        answer: str,
        sources: List[Dict[str, Any]],
        latencies: Dict[str, float],
        llm_provider: Optional[str] = None,
        llm_model: Optional[str] = None,
        token_usage: Optional[Dict[str, int]] = None,
        collection_id: Optional[str] = None,
        document_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> bool:
        """Log a /api/rag/ask generation request."""
        try:
            coll = self._get_collection()
            if coll is None:
                return False

            source_logs = [
                {
                    "source_id": s.get("source_id"),
                    "chunk_id": str(s.get("chunk_id")),
                    "document_id": str(s.get("document_id")),
                    "filename": s.get("filename"),
                    "page": s.get("page"),
                }
                for s in sources
            ]

            doc = {
                "type": "ask",
                "tenant_id": str(tenant_id),
                "collection_id": str(collection_id) if collection_id else None,
                "document_id": str(document_id) if document_id else None,
                "query": query,
                "answer": answer,
                "source_count": len(sources),
                "sources": source_logs,
                "latencies_ms": latencies,
                "embedding_model": settings.embedding_model,
                "reranker_model": settings.reranker_model if settings.reranker_enabled else None,
                "llm_provider": llm_provider,
                "llm_model": llm_model,
                "token_usage": token_usage,
                "error": error,
                "timestamp": datetime.now(timezone.utc),
            }

            coll.insert_one(doc)
            return True

        except Exception as exc:
            logger.warning(f"MongoDB logging failed (ask proceeding safely): {exc}")
            return False


# Singleton instance
analytics_logger = MongoRAGLogger()
