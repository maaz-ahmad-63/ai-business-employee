import uuid

from sqlalchemy import text

from app.embeddings.bge_m3 import embedding_service
from app.storage.database import SessionLocal


db = SessionLocal()

try:
    # Create tenant
    tenant_id = uuid.uuid4()

    db.execute(
        text("""
            INSERT INTO tenants (id, name, slug)
            VALUES (:id, :name, :slug)
        """),
        {
            "id": tenant_id,
            "name": "Test Company",
            "slug": f"test-company-{tenant_id.hex[:8]}",
        },
    )

    # Create collection
    collection_id = uuid.uuid4()

    db.execute(
        text("""
            INSERT INTO collections (id, tenant_id, name)
            VALUES (:id, :tenant_id, :name)
        """),
        {
            "id": collection_id,
            "tenant_id": tenant_id,
            "name": "Test Collection",
        },
    )

    # Create document
    document_id = uuid.uuid4()

    db.execute(
        text("""
            INSERT INTO documents (
                id,
                tenant_id,
                collection_id,
                filename,
                source,
                status
            )
            VALUES (
                :id,
                :tenant_id,
                :collection_id,
                :filename,
                :source,
                :status
            )
        """),
        {
            "id": document_id,
            "tenant_id": tenant_id,
            "collection_id": collection_id,
            "filename": "test.txt",
            "source": "test",
            "status": "completed",
        },
    )

    # Generate embedding
    content = "Maaz is a computer science student."

    embedding = embedding_service.embed(content)

    print("Embedding dimension:", len(embedding))

    # Store chunk
    chunk_id = uuid.uuid4()

    db.execute(
        text("""
            INSERT INTO chunks (
                id,
                tenant_id,
                document_id,
                chunk_index,
                content,
                embedding
            )
            VALUES (
                :id,
                :tenant_id,
                :document_id,
                :chunk_index,
                :content,
                CAST(:embedding AS vector)
            )
        """),
        {
            "id": chunk_id,
            "tenant_id": tenant_id,
            "document_id": document_id,
            "chunk_index": 0,
            "content": content,
            "embedding": str(embedding),
        },
    )

    db.commit()

    print("Tenant ID:", tenant_id)
    print("Document ID:", document_id)
    print("Chunk ID:", chunk_id)
    print("Stored successfully!")

except Exception:
    db.rollback()
    raise

finally:
    db.close()
