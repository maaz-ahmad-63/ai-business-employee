import pytest


def test_tenants_and_collections_api(client, test_tenant):
    # 1. List tenants
    t_resp = client.get("/api/rag/tenants")
    assert t_resp.status_code == 200
    tenants = t_resp.json()
    assert len(tenants) >= 1
    assert any(t["id"] == test_tenant for t in tenants)

    # 2. Create collection
    col_payload = {
        "tenant_id": test_tenant,
        "name": "Engineering Knowledge",
        "description": "System architecture and guides",
    }
    col_resp = client.post("/api/rag/collections", json=col_payload)
    assert col_resp.status_code == 201
    col_data = col_resp.json()
    assert col_data["name"] == "Engineering Knowledge"
    col_id = col_data["id"]

    # 3. List collections
    list_col_resp = client.get(f"/api/rag/collections?tenant_id={test_tenant}")
    assert list_col_resp.status_code == 200
    cols = list_col_resp.json()
    assert len(cols) >= 1
    assert any(c["id"] == col_id for c in cols)

    # 4. Ingest doc in collection
    ingest_resp = client.post(
        "/api/rag/ingest",
        json={
            "tenant_id": test_tenant,
            "collection_id": col_id,
            "text": "PostgreSQL pgvector stores 1024-dimensional embeddings for hybrid search.",
            "filename": "arch_doc.txt",
        },
    )
    assert ingest_resp.status_code == 201
    doc_id = ingest_resp.json()["document_id"]

    # 5. List documents for tenant
    docs_resp = client.get(f"/api/rag/documents?tenant_id={test_tenant}")
    assert docs_resp.status_code == 200
    docs = docs_resp.json()
    assert len(docs) >= 1
    assert any(d["id"] == doc_id for d in docs)

    # 6. Get document detail with chunk breakdown
    detail_resp = client.get(f"/api/rag/documents/{doc_id}?tenant_id={test_tenant}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["id"] == doc_id
    assert len(detail_data["chunks"]) >= 1
    assert "pgvector" in detail_data["chunks"][0]["content"]

    # 7. Delete document
    del_resp = client.delete(f"/api/rag/documents/{doc_id}?tenant_id={test_tenant}")
    assert del_resp.status_code == 200

    # Verify document is gone
    get_del_resp = client.get(f"/api/rag/documents/{doc_id}?tenant_id={test_tenant}")
    assert get_del_resp.status_code == 404

    # 8. Delete collection
    del_col_resp = client.delete(f"/api/rag/collections/{col_id}?tenant_id={test_tenant}")
    assert del_col_resp.status_code == 200


def test_conversations_api_flow(client, test_tenant):
    # Ingest document
    client.post(
        "/api/rag/ingest",
        json={
            "tenant_id": test_tenant,
            "text": "FastAPI is a modern, high-performance web framework for building APIs with Python.",
            "filename": "fastapi_guide.txt",
        },
    )

    # 1. Create conversation
    conv_resp = client.post(
        "/api/rag/conversations",
        json={"tenant_id": test_tenant, "title": "Framework Exploration"},
    )
    assert conv_resp.status_code == 201
    conv_id = conv_resp.json()["id"]

    # 2. List conversations
    convs_resp = client.get(f"/api/rag/conversations?tenant_id={test_tenant}")
    assert convs_resp.status_code == 200
    assert len(convs_resp.json()) >= 1

    # 3. Post user message with mock LLM
    msg_resp = client.post(
        f"/api/rag/conversations/{conv_id}/messages",
        json={
            "tenant_id": test_tenant,
            "query": "What is FastAPI?",
            "llm_provider": "mock",
        },
    )
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert msg_data["user_message"]["role"] == "user"
    assert msg_data["assistant_message"]["role"] == "assistant"
    assert len(msg_data["assistant_message"]["metadata"]["sources"]) >= 1

    # 4. Get message history
    history_resp = client.get(f"/api/rag/conversations/{conv_id}/messages?tenant_id={test_tenant}")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) == 2
