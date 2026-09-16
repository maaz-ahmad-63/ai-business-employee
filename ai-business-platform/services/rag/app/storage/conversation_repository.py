import json
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.database import SessionLocal


def create_conversation(
    tenant_id: str,
    title: Optional[str] = None,
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> str:
    """Create a new conversation thread."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    cid = conversation_id or str(uuid.uuid4())
    t = title or "New Conversation"

    try:
        query = text("""
            INSERT INTO conversations (id, tenant_id, user_id, title, created_at, updated_at)
            VALUES (:id, :tenant_id, :user_id, :title, NOW(), NOW())
            RETURNING id;
        """)
        result = db.execute(
            query,
            {
                "id": cid,
                "tenant_id": str(tenant_id),
                "user_id": str(user_id) if user_id else None,
                "title": t,
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


def list_conversations(
    tenant_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """List conversations for a tenant ordered by latest update."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = text("""
            SELECT id, tenant_id, user_id, title, created_at, updated_at
            FROM conversations
            WHERE tenant_id = :tenant_id
            ORDER BY updated_at DESC
            LIMIT :limit OFFSET :offset
        """)
        result = db.execute(query, {"tenant_id": str(tenant_id), "limit": limit, "offset": offset})
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()


def get_conversation_messages(
    tenant_id: str,
    conversation_id: str,
    limit: int = 100,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Retrieve all messages in a conversation scoped to tenant."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = text("""
            SELECT id, tenant_id, conversation_id, role, content, metadata, created_at
            FROM messages
            WHERE tenant_id = :tenant_id AND conversation_id = :conversation_id
            ORDER BY created_at ASC
            LIMIT :limit
        """)
        result = db.execute(
            query,
            {
                "tenant_id": str(tenant_id),
                "conversation_id": str(conversation_id),
                "limit": limit,
            },
        )
        return [dict(row) for row in result.mappings()]
    finally:
        if should_close:
            db.close()


def add_message(
    tenant_id: str,
    conversation_id: str,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    message_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> str:
    """Append a message to a conversation thread and bump updated_at."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    mid = message_id or str(uuid.uuid4())
    meta_json = json.dumps(metadata or {})

    try:
        query = text("""
            INSERT INTO messages (id, tenant_id, conversation_id, role, content, metadata, created_at)
            VALUES (:id, :tenant_id, :conversation_id, :role, :content, CAST(:metadata AS jsonb), NOW())
            RETURNING id;
        """)
        result = db.execute(
            query,
            {
                "id": mid,
                "tenant_id": str(tenant_id),
                "conversation_id": str(conversation_id),
                "role": role,
                "content": content,
                "metadata": meta_json,
            },
        )
        res_id = str(result.scalar_one())

        # Update conversation updated_at and auto-generate title from first user query if needed
        db.execute(
            text("""
                UPDATE conversations
                SET updated_at = NOW()
                WHERE id = :conversation_id AND tenant_id = :tenant_id
            """),
            {"conversation_id": str(conversation_id), "tenant_id": str(tenant_id)},
        )

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
