"""RAG API v1 router module."""
from fastapi import APIRouter

from app.api.v1.ask import router as ask_router
from app.api.v1.health import router as health_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.search import router as search_router

router = APIRouter()
router.include_router(health_router, tags=["Health"])
router.include_router(search_router, tags=["Search"])
router.include_router(ask_router, tags=["RAG Ask"])
router.include_router(ingest_router, tags=["Ingestion"])
