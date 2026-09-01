import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import settings
from app.main import app
from app.storage.database import SessionLocal


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient instance."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session():
    """Database session fixture."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_tenant(db_session):
    """Fixture that creates and cleans up a test tenant in PostgreSQL."""
    tenant_id = str(uuid.uuid4())
    slug = f"test-tenant-{tenant_id[:8]}"

    db_session.execute(
        text("INSERT INTO tenants (id, name, slug) VALUES (:id, :name, :slug)"),
        {"id": tenant_id, "name": "Pytest Tenant", "slug": slug},
    )
    db_session.commit()

    yield tenant_id

    # Cleanup (cascades collections, documents, chunks)
    try:
        db_session.execute(text("DELETE FROM tenants WHERE id = :id"), {"id": tenant_id})
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture
def two_tenants(db_session):
    """Fixture that creates two isolated tenants for multi-tenancy tests."""
    tenant_a = str(uuid.uuid4())
    slug_a = f"tenant-a-{tenant_a[:8]}"
    tenant_b = str(uuid.uuid4())
    slug_b = f"tenant-b-{tenant_b[:8]}"

    db_session.execute(
        text("INSERT INTO tenants (id, name, slug) VALUES (:id, :name, :slug)"),
        {"id": tenant_a, "name": "Tenant Alpha", "slug": slug_a},
    )
    db_session.execute(
        text("INSERT INTO tenants (id, name, slug) VALUES (:id, :name, :slug)"),
        {"id": tenant_b, "name": "Tenant Beta", "slug": slug_b},
    )
    db_session.commit()

    yield tenant_a, tenant_b

    # Cleanup
    try:
        db_session.execute(
            text("DELETE FROM tenants WHERE id IN (:id_a, :id_b)"),
            {"id_a": tenant_a, "id_b": tenant_b},
        )
        db_session.commit()
    except Exception:
        db_session.rollback()
