# Enterprise Multi-Tenant RAG Service

A production-grade, multi-tenant Retrieval-Augmented Generation (RAG) service designed as an independent microservice for enterprise AI business platforms.

---

## 🏛️ Architecture Overview

```
DOCUMENT (TXT, PDF, DOCX)
   ↓
DOCUMENT PARSER (`app/ingestion/parser.py`)
   ↓
RECURSIVE CHUNKER (`app/chunking/chunker.py`)
   ↓
BGE-M3 EMBEDDINGS (`app/embeddings/bge_m3.py`) — 1024-dim Normalized Vectors
   ↓
PostgreSQL 17 + pgvector 0.8.6 (`app/storage/`)
   ↓
                    USER QUERY (`/api/rag/search` or `/api/rag/ask`)
                        ↓
                 BGE-M3 Query Embedding
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
        Vector Search        PostgreSQL FTS
        (HNSW Cosine)         (GIN tsvector)
              ↓                   ↓
              └─────────┬─────────┘
                        ↓
                    RRF FUSION (`app/retrieval/rrf.py`, k=60, top 20)
                        ↓
             CrossEncoder RERANKER (`BAAI/bge-reranker-base`, top 5)
                        ↓
            ┌───────────┴───────────┐
            ↓                       ↓
    `/api/rag/search`        `/api/rag/ask`
    (Top K Chunks & Scores)  (Context Construction)
                                    ↓
                             PLUGGABLE LLM
                        (OpenAI / Anthropic / Gemini / Ollama / Mock)
                                    ↓
                         ANSWER + CITATION SOURCES
                                    ↓
                       (Optional MongoDB Analytics)
```

---

## 🔐 Multi-Tenancy & Security

1. **Strict Tenant Isolation**: Every database query (vector similarity search, PostgreSQL FTS, document retrieval, and chunk deletion) strictly includes `WHERE tenant_id = :tenant_id`.
2. **Collection & Document Scoping**: Supports optional hierarchical scoping (`collection_id`, `document_id`) while maintaining tenant boundaries.
3. **No Secret Leakage**: Passwords, API keys, and authorization headers are never logged to analytics or returned in API responses.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: 3.11+
- **PostgreSQL**: 17+ with `pgvector` extension (running via Docker)

### 2. Start PostgreSQL Container
```bash
docker compose up -d postgres
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=ai_platform
POSTGRES_PASSWORD=change_this_password
POSTGRES_DB=ai_platform

# Embedding (Local BGE-M3)
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSION=1024
EMBEDDING_NORMALIZE=true

# Reranker (Local CrossEncoder)
RERANKER_ENABLED=true
RERANKER_MODEL=BAAI/bge-reranker-base
RERANKER_CANDIDATES=20
RERANKER_TOP_K=5

# Hybrid Search
RRF_K=60
DEFAULT_TOP_K=5

# Pluggable LLM (Optional)
LLM_PROVIDER=mock
LLM_MODEL=mock-model
LLM_API_KEY=
```

### 4. Install Dependencies
```bash
source .venv/bin/activate
pip install -r services/rag/requirements.txt
```

### 5. Run the Service
From project root:
```bash
source .venv/bin/activate
PYTHONPATH=services/rag uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at: `http://localhost:8000/docs`.

---

## 📡 API Reference & Examples

### 1. Health Check
```bash
curl -X GET http://localhost:8000/api/rag/health
```

### 2. Ingest Plain Text Document
```bash
curl -X POST http://localhost:8000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "650cf5a7-1cf4-4513-90df-df3bf86ef9b8",
    "text": "Acme Corp refund policy allows full refunds within 30 days of purchase.",
    "filename": "refund_policy.txt"
  }'
```

### 3. Ingest File (TXT, PDF, DOCX)
```bash
curl -X POST http://localhost:8000/api/rag/ingest/file \
  -F "tenant_id=650cf5a7-1cf4-4513-90df-df3bf86ef9b8" \
  -F "file=@sample_policy.pdf"
```

### 4. Hybrid Search (`/api/rag/search`)
```bash
curl -X POST http://localhost:8000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "650cf5a7-1cf4-4513-90df-df3bf86ef9b8",
    "query": "What is the return and refund timeframe?",
    "top_k": 5,
    "candidate_k": 20,
    "rerank": true
  }'
```

Response:
```json
{
  "found": true,
  "results": [
    {
      "chunk_id": "cb97eb93-4360-4e87-973c-036b9bc258ba",
      "document_id": "cdf28c73-196f-4566-9300-9c2f75686d28",
      "chunk_index": 0,
      "content": "Acme Corp refund policy allows full refunds within 30 days of purchase.",
      "vector_score": 0.84,
      "keyword_score": 0.32,
      "rrf_score": 0.032,
      "rerank_score": 0.98,
      "metadata": { "filename": "refund_policy.txt" }
    }
  ],
  "query": "What is the return and refund timeframe?",
  "top_k": 5,
  "took_ms": 42.15,
  "latencies": {
    "embedding_ms": 12.3,
    "vector_ms": 4.1,
    "fts_ms": 1.2,
    "rrf_ms": 0.01,
    "rerank_ms": 18.5,
    "took_ms": 42.15
  }
}
```

### 5. RAG Ask (`/api/rag/ask`)
```bash
curl -X POST http://localhost:8000/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "650cf5a7-1cf4-4513-90df-df3bf86ef9b8",
    "query": "How many days do I have to return an item?",
    "top_k": 5,
    "llm_provider": "mock"
  }'
```

---

## 🤖 Connecting External LLM Providers

The RAG service includes a pluggable provider abstraction (`app/llm/`). You can configure any of the following:

- **OpenAI**:
  ```env
  LLM_PROVIDER=openai
  LLM_MODEL=gpt-4o-mini
  LLM_API_KEY=sk-...
  ```
- **Anthropic**:
  ```env
  LLM_PROVIDER=anthropic
  LLM_MODEL=claude-3-5-sonnet-20241022
  LLM_API_KEY=sk-ant-...
  ```
- **Google Gemini**:
  ```env
  LLM_PROVIDER=gemini
  LLM_MODEL=gemini-1.5-flash
  LLM_API_KEY=AIzaSy...
  ```
- **Local Ollama**:
  ```env
  LLM_PROVIDER=ollama
  LLM_MODEL=llama3.2
  LLM_API_BASE=http://localhost:11434
  ```

---

## 🧪 Running Automated Tests

Run the complete test suite:
```bash
source .venv/bin/activate
pytest services/rag/tests/ -v
```
