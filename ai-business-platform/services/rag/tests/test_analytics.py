import pytest
from app.analytics.mongo_logger import MongoRAGLogger


def test_mongo_logger_unconfigured_safe_fallback():
    """Verify logger returns False safely without error when MongoDB is not configured."""
    logger = MongoRAGLogger(mongo_url=None)
    logged = logger.log_retrieval(
        tenant_id="test-tenant",
        query="test query",
        top_k=5,
        candidate_count=20,
        results=[],
        latencies={"took_ms": 10.0},
    )
    assert logged is False

    logged_ask = logger.log_ask(
        tenant_id="test-tenant",
        query="test query",
        answer="test answer",
        sources=[],
        latencies={"took_ms": 15.0},
    )
    assert logged_ask is False


def test_mongo_logger_invalid_host_safe_fallback():
    """Verify logger gracefully handles unreachable MongoDB host without crashing application."""
    logger = MongoRAGLogger(mongo_url="mongodb://invalid-nonexistent-host:27017")
    logged = logger.log_retrieval(
        tenant_id="test-tenant",
        query="test query",
        top_k=5,
        candidate_count=20,
        results=[],
        latencies={"took_ms": 10.0},
    )
    assert logged is False
