import {
  AskResponse,
  ChatMessage,
  Collection,
  Conversation,
  DocumentItem,
  SystemHealth,
  Tenant,
} from '../types/rag'

const API_BASE = '/api/rag'

export const api = {
  // System Health
  async getHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) throw new Error('Health check failed')
    return res.json()
  },

  // Tenants
  async getTenants(): Promise<Tenant[]> {
    const res = await fetch(`${API_BASE}/tenants`)
    if (!res.ok) throw new Error('Failed to fetch tenants')
    return res.json()
  },

  async createTenant(name: string, slug?: string): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create tenant')
    }
    return res.json()
  },

  // Collections
  async getCollections(tenantId: string): Promise<Collection[]> {
    const res = await fetch(`${API_BASE}/collections?tenant_id=${tenantId}`)
    if (!res.ok) throw new Error('Failed to fetch collections')
    return res.json()
  },

  async createCollection(
    tenantId: string,
    name: string,
    description?: string
  ): Promise<Collection> {
    const res = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, name, description }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create collection')
    }
    return res.json()
  },

  async deleteCollection(tenantId: string, collectionId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE}/collections/${collectionId}?tenant_id=${tenantId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) throw new Error('Failed to delete collection')
  },

  // Documents
  async getDocuments(
    tenantId: string,
    collectionId?: string | null
  ): Promise<DocumentItem[]> {
    let url = `${API_BASE}/documents?tenant_id=${tenantId}`
    if (collectionId) {
      url += `&collection_id=${collectionId}`
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch documents')
    return res.json()
  },

  async getDocument(tenantId: string, documentId: string): Promise<DocumentItem> {
    const res = await fetch(
      `${API_BASE}/documents/${documentId}?tenant_id=${tenantId}`
    )
    if (!res.ok) throw new Error('Failed to fetch document details')
    return res.json()
  },

  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE}/documents/${documentId}?tenant_id=${tenantId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) throw new Error('Failed to delete document')
  },

  // Ingestion
  async ingestText(
    tenantId: string,
    text: string,
    filename: string = 'document.txt',
    collectionId?: string | null
  ): Promise<{ document_id: string; chunk_count: number; status: string }> {
    const res = await fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        text,
        filename,
        collection_id: collectionId || null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to ingest text document')
    }
    return res.json()
  },

  async ingestFile(
    tenantId: string,
    file: File,
    collectionId?: string | null
  ): Promise<{ document_id: string; chunk_count: number; status: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tenant_id', tenantId)
    if (collectionId) {
      formData.append('collection_id', collectionId)
    }

    const res = await fetch(`${API_BASE}/ingest/file`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to ingest document file')
    }
    return res.json()
  },

  // Search & Ask
  async askQuestion(
    tenantId: string,
    query: string,
    options?: {
      topK?: number
      collectionId?: string | null
      llmProvider?: string | null
      llmModel?: string | null
      apiKey?: string | null
    }
  ): Promise<AskResponse> {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        query,
        top_k: options?.topK || 5,
        collection_id: options?.collectionId || null,
        llm_provider: options?.llmProvider || undefined,
        llm_model: options?.llmModel || undefined,
        api_key: options?.apiKey || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to retrieve RAG answer')
    }
    return res.json()
  },

  // Conversations
  async getConversations(tenantId: string): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/conversations?tenant_id=${tenantId}`)
    if (!res.ok) throw new Error('Failed to fetch conversations')
    return res.json()
  },

  async createConversation(
    tenantId: string,
    title?: string
  ): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, title: title || 'New Conversation' }),
    })
    if (!res.ok) throw new Error('Failed to create conversation')
    return res.json()
  },

  async getMessages(
    tenantId: string,
    conversationId: string
  ): Promise<ChatMessage[]> {
    const res = await fetch(
      `${API_BASE}/conversations/${conversationId}/messages?tenant_id=${tenantId}`
    )
    if (!res.ok) throw new Error('Failed to fetch messages')
    return res.json()
  },

  async sendMessage(
    tenantId: string,
    conversationId: string,
    query: string,
    options?: {
      collectionId?: string | null
      topK?: number
      llmProvider?: string | null
      llmModel?: string | null
      apiKey?: string | null
    }
  ): Promise<{ user_message: ChatMessage; assistant_message: ChatMessage }> {
    const res = await fetch(
      `${API_BASE}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          query,
          collection_id: options?.collectionId || null,
          top_k: options?.topK || 5,
          llm_provider: options?.llmProvider || undefined,
          llm_model: options?.llmModel || undefined,
          api_key: options?.apiKey || undefined,
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to send message')
    }
    return res.json()
  },
}
