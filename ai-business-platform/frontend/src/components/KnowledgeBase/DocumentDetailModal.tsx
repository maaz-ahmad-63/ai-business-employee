import React, { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Database,
  FileCode,
  FileText,
  Hash,
  Layers,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { api } from '../../api/client'
import { useTenant } from '../../context/TenantContext'
import { DocumentChunk, DocumentItem } from '../../types/rag'

interface DocumentDetailModalProps {
  documentId: string | null
  onClose: () => void
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  documentId,
  onClose,
}) => {
  const { activeTenant } = useTenant()
  const [doc, setDoc] = useState<DocumentItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => {
    if (!documentId || !activeTenant) return

    const loadDoc = async () => {
      setIsLoading(true)
      try {
        const data = await api.getDocument(activeTenant.id, documentId)
        setDoc(data)
      } catch (err) {
        console.error('Failed to load document details:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadDoc()
  }, [documentId, activeTenant])

  if (!documentId) return null

  const filteredChunks = (doc?.chunks || []).filter((c) =>
    c.content.toLowerCase().includes(searchFilter.toLowerCase())
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-sidebar)',
          boxShadow: 'var(--shadow-md)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {doc?.filename || 'Document Details'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>ID: {doc?.id.slice(0, 12)}...</span>
                <span>•</span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  {doc?.status.toUpperCase()}
                </span>
                <span>•</span>
                <span>{doc?.chunks?.length || 0} Chunks Indexed (1024d)</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
            <p>Loading document metadata and vector chunks...</p>
          </div>
        ) : !doc ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--status-danger)' }}>
            Document not found or access denied.
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: Metadata summary */}
            <div
              style={{
                width: '260px',
                borderRight: '1px solid var(--border-glass)',
                padding: '20px',
                background: 'var(--bg-app)',
                overflowY: 'auto',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  FILE DETAILS
                </span>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Mime Type: <strong>{doc.mime_type || 'text/plain'}</strong></div>
                  <div>Size: <strong>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</strong></div>
                  <div>Created: <strong>{new Date(doc.created_at).toLocaleDateString()}</strong></div>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  INDEXING METRICS
                </span>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Embeddings: <strong>BGE-M3 (1024d)</strong></div>
                  <div>Chunk Count: <strong>{doc.chunks?.length || 0}</strong></div>
                  <div>Vector Index: <strong>HNSW Cosine</strong></div>
                  <div>FTS Index: <strong>PostgreSQL GIN</strong></div>
                </div>
              </div>

              {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    CUSTOM METADATA
                  </span>
                  <pre
                    style={{
                      marginTop: '6px',
                      padding: '8px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                      border: '1px solid var(--border-glass)',
                    }}
                  >
                    {JSON.stringify(doc.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Right: Chunk list */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Search Bar */}
              <div
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border-glass)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter chunk text..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '100%',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {filteredChunks.length} of {doc.chunks?.length || 0} chunks
                </span>
              </div>

              {/* Chunk List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredChunks.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            background: 'var(--bg-surface-active)',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          CHUNK #{c.chunk_index + 1}
                        </span>
                        {c.metadata?.page && (
                          <span
                            style={{
                              padding: '2px 6px',
                              background: 'var(--status-info-bg)',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: 'var(--status-info)',
                            }}
                          >
                            Page {c.metadata.page}
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {c.content.length} characters
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
