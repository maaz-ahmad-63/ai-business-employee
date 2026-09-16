import logging
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.storage.collection_repository import (
    create_collection,
    delete_collection,
    get_collection,
    list_collections,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateCollectionRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID")
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class CollectionResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    document_count: int = 0
    created_at: Any
    updated_at: Any


@router.get("/collections", response_model=List[CollectionResponse])
def get_collections(
    tenant_id: str = Query(..., description="Tenant ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List collections for a tenant with document counts."""
    try:
        colls = list_collections(tenant_id=tenant_id, limit=limit, offset=offset)
        return [
            CollectionResponse(
                id=str(c["id"]),
                tenant_id=str(c["tenant_id"]),
                name=c["name"],
                description=c.get("description"),
                document_count=c.get("document_count", 0),
                created_at=c["created_at"],
                updated_at=c["updated_at"],
            )
            for c in colls
        ]
    except Exception as exc:
        logger.exception(f"Error listing collections for tenant {tenant_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to list collections")


@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
def create_new_collection(request: CreateCollectionRequest):
    """Create a new knowledge collection under a tenant."""
    try:
        cid = create_collection(
            tenant_id=request.tenant_id,
            name=request.name,
            description=request.description,
        )
        coll = get_collection(tenant_id=request.tenant_id, collection_id=cid)
        if not coll:
            raise HTTPException(status_code=500, detail="Failed to retrieve created collection")

        return CollectionResponse(
            id=str(coll["id"]),
            tenant_id=str(coll["tenant_id"]),
            name=coll["name"],
            description=coll.get("description"),
            document_count=0,
            created_at=coll["created_at"],
            updated_at=coll["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error creating collection: {exc}")
        raise HTTPException(status_code=400, detail=f"Failed to create collection: {str(exc)}")


@router.delete("/collections/{collection_id}", status_code=status.HTTP_200_OK)
def delete_collection_by_id(
    collection_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
):
    """Delete a collection."""
    deleted = delete_collection(tenant_id=tenant_id, collection_id=collection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"deleted": True, "collection_id": collection_id}
