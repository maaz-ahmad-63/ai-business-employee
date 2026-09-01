import pytest


def test_api_health(client):
    response = client.get("/api/rag/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "database" in data
    assert data["embedding_model"] == "BAAI/bge-m3"


def test_api_ingest_and_search(client, test_tenant):
    # 1. Ingest document via API
    ingest_payload = {
        "tenant_id": test_tenant,
        "text": "The refund policy allows customer returns within 30 days of purchase for full refund.",
        "filename": "refund_policy.txt",
    }
    ingest_resp = client.post("/api/rag/ingest", json=ingest_payload)
    assert ingest_resp.status_code == 201
    ingest_data = ingest_resp.json()
    assert ingest_data["status"] == "completed"
    assert ingest_data["chunk_count"] >= 1

    # 2. Search via API
    search_payload = {
        "tenant_id": test_tenant,
        "query": "What is the return and refund policy?",
        "top_k": 3,
    }
    search_resp = client.post("/api/rag/search", json=search_payload)
    assert search_resp.status_code == 200
    search_data = search_resp.json()

    assert search_data["found"] is True
    assert len(search_data["results"]) >= 1
    assert "30 days" in search_data["results"][0]["content"]
    assert "took_ms" in search_data
    assert "latencies" in search_data


def test_api_ask_with_mock_llm(client, test_tenant):
    # Ingest document
    client.post(
        "/api/rag/ingest",
        json={
            "tenant_id": test_tenant,
            "text": "Antigravity IDE is built by the Google Deepmind team for advanced agentic coding.",
            "filename": "deepmind.txt",
        },
    )

    # Ask endpoint with explicit mock LLM provider
    ask_payload = {
        "tenant_id": test_tenant,
        "query": "Who built Antigravity IDE?",
        "top_k": 3,
        "llm_provider": "mock",
    }
    ask_resp = client.post("/api/rag/ask", json=ask_payload)
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()

    assert "answer" in ask_data
    assert len(ask_data["sources"]) >= 1
    assert ask_data["sources"][0]["filename"] == "deepmind.txt"
    assert ask_data["llm"]["provider"] == "mock"


def test_api_ask_without_llm_configured(client, test_tenant):
    # Ingest document
    client.post(
        "/api/rag/ingest",
        json={
            "tenant_id": test_tenant,
            "text": "Python 3.11 introduced substantial performance improvements.",
            "filename": "python.txt",
        },
    )

    # Ask without LLM provider
    ask_payload = {
        "tenant_id": test_tenant,
        "query": "What did Python 3.11 introduce?",
        "top_k": 3,
        "llm_provider": None,
    }
    ask_resp = client.post("/api/rag/ask", json=ask_payload)
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()

    # Returns informative fallback message with full retrieval sources
    assert "Retrieved" in ask_data["answer"]
    assert len(ask_data["sources"]) >= 1
    assert ask_data["llm"]["provider"] == "none"
