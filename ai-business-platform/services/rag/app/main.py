import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as api_v1_router
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag_service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Initializing Enterprise Multi-Tenant RAG Service...")
    logger.info(f"Embedding model: {settings.embedding_model} (dim={settings.embedding_dimension})")
    logger.info(f"Reranker model: {settings.reranker_model} (enabled={settings.reranker_enabled})")
    logger.info(f"LLM Provider: {settings.llm_provider or 'none'}")
    logger.info(f"PostgreSQL target: {settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}")
    yield
    logger.info("Shutting down RAG Service.")


app = FastAPI(
    title="Enterprise Multi-Tenant RAG Service",
    description="High-performance Multi-Tenant Retrieval-Augmented Generation API with BGE-M3, pgvector HNSW, GIN FTS, RRF, CrossEncoder, and Pluggable LLM.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api/rag
app.include_router(api_v1_router, prefix="/api/rag")


@app.get("/")
def root():
    return {
        "service": "Enterprise Multi-Tenant RAG Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/rag/health",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )
