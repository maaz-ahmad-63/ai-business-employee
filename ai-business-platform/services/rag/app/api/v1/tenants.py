import logging
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.storage.tenant_repository import create_tenant, get_tenant, list_tenants

logger = logging.getLogger(__name__)
router = APIRouter()


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: Any
    updated_at: Any


class CreateTenantRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = None


@router.get("/tenants", response_model=List[TenantResponse])
def get_tenants(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List tenants in system."""
    try:
        tenants = list_tenants(limit=limit, offset=offset)
        return [
            TenantResponse(
                id=str(t["id"]),
                name=t["name"],
                slug=t["slug"],
                created_at=t["created_at"],
                updated_at=t["updated_at"],
            )
            for t in tenants
        ]
    except Exception as exc:
        logger.exception(f"Error listing tenants: {exc}")
        raise HTTPException(status_code=500, detail="Failed to list tenants")


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_new_tenant(request: CreateTenantRequest):
    """Create a new tenant."""
    try:
        tid = create_tenant(name=request.name, slug=request.slug)
        t = get_tenant(tenant_id=tid)
        if not t:
            raise HTTPException(status_code=500, detail="Failed to retrieve created tenant")
        return TenantResponse(
            id=str(t["id"]),
            name=t["name"],
            slug=t["slug"],
            created_at=t["created_at"],
            updated_at=t["updated_at"],
        )
    except Exception as exc:
        logger.exception(f"Error creating tenant: {exc}")
        raise HTTPException(status_code=400, detail=f"Failed to create tenant: {str(exc)}")
