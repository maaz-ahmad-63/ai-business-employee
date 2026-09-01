import json
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def create_document(
    tenant_id: str,
    filename: str,
    source: Optional[str] = None,
    mime_type: Optional[str] = None,
    file_size: Optional[int] = None,
    collection_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    status: str = "pending",
    doc_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> str:
    """Create a new document record under a tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    did = doc_id or str(uuid.uuid4())
    meta_json = json.dumps(metadata or {})

    try:
        query = text("""
            INSERT INTO documents (
                id,
                tenant_id,
                collection_id,
                filename,
                source,
                mime_type,
                file_size,
                status,
                metadata,
                created_at,
                updated_at
            )
            VALUES (
                :id,
                :tenant_id,
                :collection_id,
                :filename,
                :source,
                :mime_type,
                :file_size,
                :status,
                CAST(:metadata AS jsonb),
                NOW(),
                NOW()
            )
            RETURNING id;
        """)

        result = db.execute(
            query,
            {
                "id": did,
                "tenant_id": str(tenant_id),
                "collection_id": str(collection_id) if collection_id else None,
                "filename": filename,
                "source": source,
                "mime_type": mime_type,
                "file_size": file_size,
                "status": status,
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


def update_document_status(
    tenant_id: str,
    document_id: str,
    status: str,
    metadata: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> bool:
    """Update status and optionally merge metadata for a document."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        if metadata is not None:
            query = text("""
                UPDATE documents
                SET status = :status,
                    metadata = documents.metadata || CAST(:metadata AS jsonb),
                    updated_at = NOW()
                WHERE id = :document_id AND tenant_id = :tenant_id
            """)
            params = {
                "document_id": str(document_id),
                "tenant_id": str(tenant_id),
                "status": status,
                "metadata": json.dumps(metadata),
            }
        else:
            query = text("""
                UPDATE documents
                SET status = :status,
                    updated_at = NOW()
                WHERE id = :document_id AND tenant_id = :tenant_id
            """)
            params = {
                "document_id": str(document_id),
                "tenant_id": str(tenant_id),
                "status": status,
            }

        result = db.execute(query, params)
        if should_close:
            db.commit()
        return result.rowcount > 0

    except Exception:
        if should_close:
            db.rollback()
        raise
    finally:
        if should_close:
            db.close()


def get_document(
    tenant_id: str,
    document_id: str,
    db: Optional[Session] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve document by ID scoped to tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                SELECT id, tenant_id, collection_id, filename, source, mime_type, file_size, status, metadata, created_at, updated_at
                FROM documents
                WHERE id = :document_id AND tenant_id = :tenant_id
            """),
            {
                "document_id": str(document_id),
                "tenant_id": str(tenant_id),
            },
        )
        row = result.mappings().first()
        return dict(row) if row else None
    finally:
        if should_close:
            db.close()


def list_documents(
    tenant_id: str,
    collection_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """List documents for a tenant, optionally filtered by collection."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        if collection_id:
            query = text("""
                SELECT id, tenant_id, collection_id, filename, source, mime_type, file_size, status, metadata, created_at, updated_at
                FROM documents
                WHERE tenant_id = :tenant_id AND collection_id = :collection_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            params = {
                "tenant_id": str(tenant_id),
                "collection_id": str(collection_id),
                "limit": limit,
                "offset": offset,
            }
        else:
            query = text("""
                SELECT id, tenant_id, collection_id, filename, source, mime_type, file_size, status, metadata, created_at, updated_at
                FROM documents
                WHERE tenant_id = :tenant_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            params = {
                "tenant_id": str(tenant_id),
                "limit": limit,
                "offset": offset,
            }

        result = db.execute(query, params)
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()


def delete_document(
    tenant_id: str,
    document_id: str,
    db: Optional[Session] = None,
) -> bool:
    """Delete document and cascade chunks for a tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                DELETE FROM documents
                WHERE id = :document_id AND tenant_id = :tenant_id
            """),
            {
                "document_id": str(document_id),
                "tenant_id": str(tenant_id),
            },
        )
        if should_close:
            db.commit()
        return result.rowcount > 0
    except Exception:
        if should_close:
            db.rollback()
        raise
    finally:
        if should_close:
            db.close()
