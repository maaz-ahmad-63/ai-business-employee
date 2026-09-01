import pytest
from app.embeddings.bge_m3 import embedding_service
from app.ingestion.service import ingestion_service
from app.retrieval.fts import fts_search
from app.retrieval.hybrid import hybrid_search
from app.retrieval.vector import vector_search


def test_strict_multitenant_isolation(two_tenants):
    """
    CRITICAL TEST: Ensure Tenant A cannot retrieve Tenant B's data under any circumstance.
    """
    tenant_a, tenant_b = two_tenants

    # Ingest secret document for Tenant A
    ingestion_service.ingest_text(
        tenant_id=tenant_a,
        text_content="CONFIDENTIAL_ALPHA: Secret financial revenue for Tenant Alpha is $100M.",
        filename="alpha_secret.txt",
    )

    # Ingest secret document for Tenant B
    ingestion_service.ingest_text(
        tenant_id=tenant_b,
        text_content="CONFIDENTIAL_BETA: Secret intellectual property for Tenant Beta patent #998877.",
        filename="beta_secret.txt",
    )

    # 1. Test Vector Search Isolation
    q_emb = embedding_service.embed("Secret financial revenue patent")
    results_a_vector = vector_search(query_embedding=q_emb, tenant_id=tenant_a, top_k=10)
    for r in results_a_vector:
        assert "CONFIDENTIAL_BETA" not in r["content"]
        assert "Tenant Beta" not in r["content"]

    results_b_vector = vector_search(query_embedding=q_emb, tenant_id=tenant_b, top_k=10)
    for r in results_b_vector:
        assert "CONFIDENTIAL_ALPHA" not in r["content"]
        assert "Tenant Alpha" not in r["content"]

    # 2. Test FTS Search Isolation
    results_a_fts = fts_search(query="patent secret", tenant_id=tenant_a, top_k=10)
    for r in results_a_fts:
        assert "CONFIDENTIAL_BETA" not in r["content"]

    results_b_fts = fts_search(query="financial revenue", tenant_id=tenant_b, top_k=10)
    for r in results_b_fts:
        assert "CONFIDENTIAL_ALPHA" not in r["content"]

    # 3. Test Hybrid Pipeline Isolation
    results_a_hybrid = hybrid_search(query="Secret patent revenue", tenant_id=tenant_a, top_k=10)
    for r in results_a_hybrid:
        assert "CONFIDENTIAL_BETA" not in r["content"]
        assert "Tenant Beta" not in r["content"]

    results_b_hybrid = hybrid_search(query="Secret patent revenue", tenant_id=tenant_b, top_k=10)
    for r in results_b_hybrid:
        assert "CONFIDENTIAL_ALPHA" not in r["content"]
        assert "Tenant Alpha" not in r["content"]
