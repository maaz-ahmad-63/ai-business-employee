import pytest
from app.retrieval.reranker import CrossEncoderReranker, reranker_service


def test_reranker_improves_relevance_ranking():
    """Verify CrossEncoder accurately scores high relevance pairs higher than low relevance."""
    query = "What is the capital of France?"
    candidates = [
        {"id": "c1", "content": "Bananas are a rich source of potassium and dietary fiber.", "rrf_score": 0.05},
        {"id": "c2", "content": "Paris is the capital and most populous city of France.", "rrf_score": 0.04},
    ]

    # Even though c1 had higher initial rrf_score, CrossEncoder should rank c2 first
    results = reranker_service.rerank(query=query, candidates=candidates, top_k=2)

    assert len(results) == 2
    assert results[0]["id"] == "c2"
    assert results[0]["rerank_score"] > results[1]["rerank_score"]


def test_reranker_fallback_on_error():
    """Verify reranker gracefully falls back to input order when an internal error occurs."""
    broken_reranker = CrossEncoderReranker(model_name="nonexistent/fake-model-xyz")
    candidates = [
        {"id": "c1", "content": "First candidate text.", "rrf_score": 0.05},
        {"id": "c2", "content": "Second candidate text.", "rrf_score": 0.04},
    ]

    # Should not raise exception, should return candidates in original order
    results = broken_reranker.rerank(query="Test query", candidates=candidates, top_k=2)
    assert len(results) == 2
    assert results[0]["id"] == "c1"
    assert results[1]["id"] == "c2"


def test_reranker_disabled_behavior():
    """Verify disabled reranker leaves candidates in order with rerank_score as None."""
    disabled_reranker = CrossEncoderReranker(enabled=False)
    candidates = [
        {"id": "c1", "content": "Candidate one.", "rrf_score": 0.05},
        {"id": "c2", "content": "Candidate two.", "rrf_score": 0.04},
    ]

    results = disabled_reranker.rerank(query="Test", candidates=candidates, top_k=2)
    assert results[0]["id"] == "c1"
    assert results[0]["rerank_score"] is None
