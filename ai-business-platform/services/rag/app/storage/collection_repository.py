import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def create_collection(
    tenant_id: str,
    name: str,
    description: Optional[str] = None,
    collection_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> str:
    """Create a new collection for a tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    cid = collection_id or str(uuid.uuid4())

    try:
        query = text("""
            INSERT INTO collections (
                id,
                tenant_id,
                name,
                description,
                created_at,
                updated_at
            )
            VALUES (
                :id,
                :tenant_id,
                :name,
                :description,
                NOW(),
                NOW()
            )
            RETURNING id;
        """)

        result = db.execute(
            query,
            {
                "id": cid,
                "tenant_id": str(tenant_id),
                "name": name.strip(),
                "description": description.strip() if description else None,
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


def list_collections(
    tenant_id: str,
    limit: int = 100,
    offset: int = 0,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """List collections for a tenant with document counts."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = text("""
            SELECT
                c.id,
                c.tenant_id,
                c.name,
                c.description,
                c.created_at,
                c.updated_at,
                COUNT(d.id) AS document_count
            FROM collections c
            LEFT JOIN documents d ON d.collection_id = c.id AND d.tenant_id = :tenant_id
            WHERE c.tenant_id = :tenant_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = db.execute(
            query,
            {
                "tenant_id": str(tenant_id),
                "limit": limit,
                "offset": offset,
            },
        )
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()


def get_collection(
    tenant_id: str,
    collection_id: str,
    db: Optional[Session] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve collection by ID scoped to tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                SELECT id, tenant_id, name, description, created_at, updated_at
                FROM collections
                WHERE id = :collection_id AND tenant_id = :tenant_id
            """),
            {
                "collection_id": str(collection_id),
                "tenant_id": str(tenant_id),
            },
        )
        row = result.mappings().first()
        return dict(row) if row else None
    finally:
        if should_close:
            db.close()


def delete_collection(
    tenant_id: str,
    collection_id: str,
    db: Optional[Session] = None,
) -> bool:
    """Delete a collection scoped to tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        result = db.execute(
            text("""
                DELETE FROM collections
                WHERE id = :collection_id AND tenant_id = :tenant_id
            """),
            {
                "collection_id": str(collection_id),
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
