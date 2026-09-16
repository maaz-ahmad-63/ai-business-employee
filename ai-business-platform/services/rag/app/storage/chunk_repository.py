import json
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def insert_chunk(
    tenant_id: str,
    document_id: str,
    chunk_index: int,
    content: str,
    embedding: List[float],
    metadata: Optional[Dict[str, Any]] = None,
    chunk_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> str:
    """Insert a single chunk with embedding and metadata."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    cid = chunk_id or str(uuid.uuid4())
    meta_json = json.dumps(metadata or {})

    try:
        query = text("""
            INSERT INTO chunks (
                id,
                tenant_id,
                document_id,
                chunk_index,
                content,
                embedding,
                metadata
            )
            VALUES (
                :id,
                :tenant_id,
                :document_id,
                :chunk_index,
                :content,
                CAST(:embedding AS vector),
                CAST(:metadata AS jsonb)
            )
            RETURNING id;
        """)

        result = db.execute(
            query,
            {
                "id": cid,
                "tenant_id": str(tenant_id),
                "document_id": str(document_id),
                "chunk_index": chunk_index,
                "content": content,
                "embedding": str(embedding),
                "metadata": meta_json,
            },
        )

        res_id = str(result.scalar_one())
        if should_close:
            db.commit()
        return res_id

    except Exception:
        if should_close:
            db.rollback()
        raise
    finally:
        if should_close:
            db.close()


def insert_chunks_batch(
    tenant_id: str,
    chunks: List[Dict[str, Any]],
    db: Optional[Session] = None,
) -> List[str]:
    """Insert a batch of chunks in a single transaction."""
    if not chunks:
        return []

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    inserted_ids: List[str] = []

    try:
        query = text("""
            INSERT INTO chunks (
                id,
                tenant_id,
                document_id,
                chunk_index,
                content,
                embedding,
                metadata
            )
            VALUES (
                :id,
                :tenant_id,
                :document_id,
                :chunk_index,
                :content,
                CAST(:embedding AS vector),
                CAST(:metadata AS jsonb)
            )
            RETURNING id;
        """)

        for chunk in chunks:
            cid = chunk.get("id") or str(uuid.uuid4())
            meta = chunk.get("metadata") or {}
            emb = chunk.get("embedding")
            emb_str = str(emb) if emb is not None else None

            result = db.execute(
                query,
                {
                    "id": cid,
                    "tenant_id": str(tenant_id),
                    "document_id": str(chunk["document_id"]),
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "embedding": emb_str,
                    "metadata": json.dumps(meta),
                },
            )
            inserted_ids.append(str(result.scalar_one()))

        if should_close:
            db.commit()

        return inserted_ids

    except Exception:
        if should_close:
            db.rollback()
        raise
    finally:
        if should_close:
            db.close()


def get_chunk(
    tenant_id: str,
    chunk_id: str,
    db: Optional[Session] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve a single chunk ensuring tenant isolation."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                SELECT id, tenant_id, document_id, chunk_index, content, metadata, created_at
                FROM chunks
                WHERE id = :chunk_id AND tenant_id = :tenant_id
            """),
            {
                "chunk_id": str(chunk_id),
                "tenant_id": str(tenant_id),
            },
        )
        row = result.mappings().first()
        return dict(row) if row else None
    finally:
        if should_close:
            db.close()


def delete_chunks_by_document(
    tenant_id: str,
    document_id: str,
    db: Optional[Session] = None,
) -> int:
    """Delete all chunks for a document scoped to tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                DELETE FROM chunks
                WHERE tenant_id = :tenant_id AND document_id = :document_id
            """),
            {
                "tenant_id": str(tenant_id),
                "document_id": str(document_id),
            },
        )
        count = result.rowcount
        if should_close:
            db.commit()
        return count
    except Exception:
        if should_close:
            db.rollback()
        raise
    finally:
        if should_close:
            db.close()


def list_chunks_by_document(
    tenant_id: str,
    document_id: str,
    limit: int = 500,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """List all chunks for a document scoped to tenant ordered by chunk_index."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                SELECT id, tenant_id, document_id, chunk_index, content, metadata, created_at
                FROM chunks
                WHERE tenant_id = :tenant_id AND document_id = :document_id
                ORDER BY chunk_index ASC
                LIMIT :limit
            """),
            {
                "tenant_id": str(tenant_id),
                "document_id": str(document_id),
                "limit": limit,
            },
        )
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()

