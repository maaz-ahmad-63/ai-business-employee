export interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  tenant_id: string
  name: string
  description?: string | null
  document_count?: number
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  tenant_id: string
  document_id: string
  chunk_index: number
  content: string
  metadata: {
    filename?: string
    source?: string
    page?: number
    total_pages?: number
    char_count?: number
    chunk_index?: number
    [key: string]: any
  }
  created_at: string
}

export interface DocumentItem {
  id: string
  tenant_id: string
  collection_id?: string | null
  filename: string
  source?: string | null
  mime_type?: string | null
  file_size?: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  metadata: {
    chunk_count?: number
    checksum?: string
    error?: string
    section_count?: number
    [key: string]: any
  }
  created_at: string
  updated_at: string
  chunks?: DocumentChunk[]
}

export interface CitationSource {
  source_id: number
  chunk_id: string
  document_id: string
  filename?: string | null
  page?: number | null
  content: string
  metadata: Record<string, any>
}

export interface AskResponse {
  answer: string
  sources: CitationSource[]
  retrieval: {
    top_chunk_id?: string
    vector_score?: number
    keyword_score?: number
    rrf_score?: number
    rerank_score?: number
    chunks_retrieved?: number
  }
  latency_ms: {
    embedding_ms?: number
    vector_ms?: number
    fts_ms?: number
    rrf_ms?: number
    rerank_ms?: number
    llm_ms?: number
    total_ms?: number
    total_retrieval_ms?: number
  }
  llm: {
    provider?: string
    model?: string
    token_usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
    note?: string
  }
}

export interface Conversation {
  id: string
  tenant_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  tenant_id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    sources?: CitationSource[]
    latencies_ms?: Record<string, number>
    llm?: Record<string, any>
  }
  created_at: string | number
}

export interface SystemHealth {
  status: string
  database: string
  embedding_model: string
  reranker_model: string
  llm_provider?: string | null
}
