import uuid
import pytest
from app.embeddings.bge_m3 import embedding_service
from app.ingestion.service import ingestion_service
from app.retrieval.vector import vector_search


def test_vector_search_cosine_similarity(test_tenant):
    """Verify vector search returns most similar chunk with high cosine similarity."""
    ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="PostgreSQL pgvector extension enables fast vector similarity search using HNSW indexing.",
        filename="pgvector.txt",
    )
    ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Baking a chocolate cake requires flour, cocoa powder, sugar, and eggs.",
        filename="recipes.txt",
    )

    query = "How to search embeddings in PostgreSQL?"
    query_emb = embedding_service.embed(query)

    results = vector_search(
        query_embedding=query_emb,
        tenant_id=test_tenant,
        top_k=2,
    )

    assert len(results) == 2
    # The pgvector text should rank first
    assert "PostgreSQL" in results[0]["content"] or "pgvector" in results[0]["content"]
    assert results[0]["vector_score"] > results[1]["vector_score"]
    assert results[0]["vector_rank"] == 1
    assert results[1]["vector_rank"] == 2


def test_vector_search_document_filter(test_tenant):
    """Verify vector search respects document_id filter."""
    res1 = ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Document One contains information about finances.",
        filename="doc1.txt",
    )
    res2 = ingestion_service.ingest_text(
        tenant_id=test_tenant,
        text_content="Document Two contains information about engineering.",
        filename="doc2.txt",
    )

    query_emb = embedding_service.embed("finances and budget")

    # Search filtered to document 2 only
    results = vector_search(
        query_embedding=query_emb,
        tenant_id=test_tenant,
        document_id=res2["document_id"],
        top_k=5,
    )

    assert len(results) == 1
    assert results[0]["document_id"] == res2["document_id"]
    assert "engineering" in results[0]["content"]
