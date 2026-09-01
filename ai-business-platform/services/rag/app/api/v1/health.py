from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.schemas.rag import HealthResponse
from app.storage.database import SessionLocal

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint validating database connectivity."""
    db_status = "healthy"
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1;"))
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"
    finally:
        db.close()

    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        database=db_status,
        embedding_model=settings.embedding_model,
        reranker_model=settings.reranker_model if settings.reranker_enabled else "disabled",
        llm_provider=settings.llm_provider,
    )
