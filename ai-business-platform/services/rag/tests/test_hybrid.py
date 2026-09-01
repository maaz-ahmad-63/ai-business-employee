import pytest
from app.retrieval.rrf import compute_rrf


def test_rrf_dual_match_increases_score():
    """Verify a chunk found by BOTH vector and FTS search receives a higher score than single-source matches."""
    vector_results = [
        {"id": "chunk-1", "document_id": "doc-1", "content": "chunk 1", "vector_score": 0.9, "vector_rank": 1},
        {"id": "chunk-2", "document_id": "doc-2", "content": "chunk 2", "vector_score": 0.8, "vector_rank": 2},
    ]

    fts_results = [
        {"id": "chunk-2", "document_id": "doc-2", "content": "chunk 2", "keyword_score": 0.5, "fts_rank": 1},
        {"id": "chunk-3", "document_id": "doc-3", "content": "chunk 3", "keyword_score": 0.4, "fts_rank": 2},
    ]

    # chunk-2 appears in both (rank 2 in vector, rank 1 in FTS)
    # chunk-1 appears only in vector (rank 1)
    # chunk-3 appears only in FTS (rank 2)
    rrf_results = compute_rrf(vector_results, fts_results, rrf_k=60)

    # Calculate expected scores with k=60
    # chunk-2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 = 0.016129 + 0.016393 = 0.032522
    # chunk-1: 1/(60+1) = 0.016393
    # chunk-3: 1/(60+2) = 0.016129
    assert rrf_results[0]["id"] == "chunk-2"
    assert rrf_results[0]["vector_rank"] == 2
    assert rrf_results[0]["fts_rank"] == 1
    assert rrf_results[0]["rrf_score"] > rrf_results[1]["rrf_score"]


def test_rrf_vector_only_survives():
    """Verify vector-only results survive and retain metadata."""
    vector_results = [
        {"id": "chunk-v", "document_id": "doc-v", "content": "vector content", "vector_score": 0.88, "vector_rank": 1}
    ]
    fts_results = []

    rrf_results = compute_rrf(vector_results, fts_results, rrf_k=60)

    assert len(rrf_results) == 1
    assert rrf_results[0]["id"] == "chunk-v"
    assert rrf_results[0]["vector_rank"] == 1
    assert rrf_results[0]["fts_rank"] is None
    assert rrf_results[0]["keyword_score"] is None
    assert rrf_results[0]["rrf_score"] == 1.0 / 61


def test_rrf_fts_only_survives():
    """Verify FTS-only results survive and retain metadata."""
    vector_results = []
    fts_results = [
        {"id": "chunk-f", "document_id": "doc-f", "content": "keyword content", "keyword_score": 0.75, "fts_rank": 1}
    ]

    rrf_results = compute_rrf(vector_results, fts_results, rrf_k=60)

    assert len(rrf_results) == 1
    assert rrf_results[0]["id"] == "chunk-f"
    assert rrf_results[0]["fts_rank"] == 1
    assert rrf_results[0]["vector_rank"] is None
    assert rrf_results[0]["vector_score"] is None
    assert rrf_results[0]["rrf_score"] == 1.0 / 61
