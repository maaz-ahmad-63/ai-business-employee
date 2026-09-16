import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def list_tenants(limit: int = 50, offset: int = 0, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """List tenants in system."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = text("""
            SELECT id, name, slug, created_at, updated_at
            FROM tenants
            ORDER BY created_at ASC
            LIMIT :limit OFFSET :offset
        """)
        result = db.execute(query, {"limit": limit, "offset": offset})
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()


def get_tenant(tenant_id: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """Get single tenant by ID."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = text("""
            SELECT id, name, slug, created_at, updated_at
            FROM tenants
            WHERE id = :tenant_id
        """)
        result = db.execute(query, {"tenant_id": str(tenant_id)})
        row = result.mappings().first()
        return dict(row) if row else None
    finally:
        if should_close:
            db.close()


def create_tenant(name: str, slug: Optional[str] = None, tenant_id: Optional[str] = None, db: Optional[Session] = None) -> str:
    """Create a new tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    tid = tenant_id or str(uuid.uuid4())
    s = slug or f"{name.lower().replace(' ', '-')[:20]}-{tid[:6]}"

    try:
        query = text("""
            INSERT INTO tenants (id, name, slug, created_at, updated_at)
            VALUES (:id, :name, :slug, NOW(), NOW())
            RETURNING id;
        """)
        result = db.execute(query, {"id": tid, "name": name, "slug": s})
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
