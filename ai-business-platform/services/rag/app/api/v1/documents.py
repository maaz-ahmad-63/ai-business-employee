import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.storage.chunk_repository import delete_chunks_by_document, list_chunks_by_document
from app.storage.document_repository import delete_document, get_document, list_documents

logger = logging.getLogger(__name__)
router = APIRouter()


class DocumentResponse(BaseModel):
    id: str
    tenant_id: str
    collection_id: Optional[str] = None
    filename: str
    source: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    metadata: Dict[str, Any] = {}
    created_at: Any
    updated_at: Any


class ChunkDetailResponse(BaseModel):
    id: str
    tenant_id: str
    document_id: str
    chunk_index: int
    content: str
    metadata: Dict[str, Any] = {}
    created_at: Any


class DocumentDetailResponse(DocumentResponse):
    chunks: List[ChunkDetailResponse] = []


@router.get("/documents", response_model=List[DocumentResponse])
def get_documents(
    tenant_id: str = Query(..., description="Tenant ID to list documents for"),
    collection_id: Optional[str] = Query(None, description="Filter by collection"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all documents for a tenant with their status and metadata."""
    try:
        docs = list_documents(
            tenant_id=tenant_id,
            collection_id=collection_id,
            limit=limit,
            offset=offset,
        )
        return [
            DocumentResponse(
                id=str(d["id"]),
                tenant_id=str(d["tenant_id"]),
                collection_id=str(d["collection_id"]) if d["collection_id"] else None,
                filename=d["filename"],
                source=d.get("source"),
                mime_type=d.get("mime_type"),
                file_size=d.get("file_size"),
                status=d.get("status", "pending"),
                metadata=d.get("metadata") or {},
                created_at=d["created_at"],
                updated_at=d["updated_at"],
            )
            for d in docs
        ]
    except Exception as exc:
        logger.exception(f"Error listing documents for tenant {tenant_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to list documents")


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document_details(
    document_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
):
    """Retrieve detailed document metadata and its chunk breakdown."""
    doc = get_document(tenant_id=tenant_id, document_id=document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = list_chunks_by_document(tenant_id=tenant_id, document_id=document_id)

    return DocumentDetailResponse(
        id=str(doc["id"]),
        tenant_id=str(doc["tenant_id"]),
        collection_id=str(doc["collection_id"]) if doc["collection_id"] else None,
        filename=doc["filename"],
        source=doc.get("source"),
        mime_type=doc.get("mime_type"),
        file_size=doc.get("file_size"),
        status=doc.get("status", "pending"),
        metadata=doc.get("metadata") or {},
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        chunks=[
            ChunkDetailResponse(
                id=str(c["id"]),
                tenant_id=str(c["tenant_id"]),
                document_id=str(c["document_id"]),
                chunk_index=c["chunk_index"],
                content=c["content"],
                metadata=c.get("metadata") or {},
                created_at=c["created_at"],
            )
            for c in chunks
        ],
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
def delete_document_by_id(
    document_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
):
    """Securely delete a document and cascade remove all chunks scoped to tenant."""
    doc = get_document(tenant_id=tenant_id, document_id=document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    deleted = delete_document(tenant_id=tenant_id, document_id=document_id)
    return {"deleted": deleted, "document_id": document_id}
