from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# Search Schemas
# ==============================================================================

class SearchRequest(BaseModel):
    tenant_id: str = Field(..., description="Unique tenant ID for data isolation")
    query: str = Field(..., min_length=1, description="Natural language search query")
    top_k: int = Field(default=5, ge=1, le=100, description="Final number of top results to return")
    candidate_k: int = Field(default=20, ge=1, le=200, description="Candidates to retrieve before reranking")
    collection_id: Optional[str] = Field(default=None, description="Optional collection filter")
    document_id: Optional[str] = Field(default=None, description="Optional document filter")
    rerank: bool = Field(default=True, description="Whether to apply CrossEncoder reranking")


class SearchResultChunk(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int = 0
    content: str
    vector_score: Optional[float] = None
    keyword_score: Optional[float] = None
    rrf_score: Optional[float] = None
    rerank_score: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    found: bool
    results: List[SearchResultChunk]
    query: str
    top_k: int
    took_ms: float
    latencies: Dict[str, float] = Field(default_factory=dict)


# ==============================================================================
# Ask Schemas
# ==============================================================================

class AskRequest(BaseModel):
    tenant_id: str = Field(..., description="Unique tenant ID for data isolation")
    query: str = Field(..., min_length=1, description="User question to answer via RAG")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of context chunks to retrieve")
    collection_id: Optional[str] = Field(default=None, description="Optional collection filter")
    document_id: Optional[str] = Field(default=None, description="Optional document filter")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=4096)
    llm_provider: Optional[str] = Field(default=None, description="Optional provider override (openai/anthropic/gemini/ollama/mock)")
    llm_model: Optional[str] = Field(default=None, description="Optional model override")


class CitationSource(BaseModel):
    source_id: int
    chunk_id: str
    document_id: str
    filename: Optional[str] = None
    page: Optional[int] = None
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AskResponse(BaseModel):
    answer: str
    sources: List[CitationSource]
    retrieval: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: Dict[str, float] = Field(default_factory=dict)
    llm: Dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# Ingestion Schemas
# ==============================================================================

class IngestTextRequest(BaseModel):
    tenant_id: str = Field(..., description="Unique tenant ID")
    text: str = Field(..., min_length=1, description="Raw text content to ingest")
    filename: str = Field(default="document.txt", description="Document filename")
    source: Optional[str] = Field(default=None, description="Source identifier or URL")
    collection_id: Optional[str] = Field(default=None, description="Optional collection ID")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Custom document metadata")
    chunk_size: Optional[int] = Field(default=None, ge=50, le=5000)
    chunk_overlap: Optional[int] = Field(default=None, ge=0, le=1000)


class IngestResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    status: str
    took_ms: float


class HealthResponse(BaseModel):
    status: str
    database: str
    embedding_model: str
    reranker_model: str
    llm_provider: Optional[str] = None
