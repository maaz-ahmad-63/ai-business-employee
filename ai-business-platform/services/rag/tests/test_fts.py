import pytest
from app.ingestion.service import ingestion_service
from app.retrieval.fts import fts_search


def test_fts_exact_keyword_match(test_tenant):
    """Verify PostgreSQL full text search finds exact terms."""
    ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Quantum computing utilizes qubits, superposition, and entanglement for exponential speedups.",
        filename="quantum.txt",
    )
    ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Traditional classical computers rely on binary bits of zeros and ones.",
        filename="classical.txt",
    )

    results = fts_search(
        query="quantum superposition entanglement",
        tenant_id=test_tenant,
        top_k=5,
    )

    assert len(results) >= 1
    assert "qubits" in results[0]["content"]
    assert results[0]["keyword_score"] > 0.0
    assert results[0]["fts_rank"] == 1


def test_fts_no_match(test_tenant):
    """Verify FTS search returns empty list without error on no match."""
    ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Some simple text about astronomy and stars.",
        filename="astronomy.txt",
    )

    results = fts_search(
        query="microbiology ribosome mitochondria",
        tenant_id=test_tenant,
        top_k=5,
    )

    assert results == []


def test_fts_empty_query(test_tenant):
    """Verify empty query string handled safely."""
    results = fts_search(
        query="",
        tenant_id=test_tenant,
        top_k=5,
    )
    assert results == []
