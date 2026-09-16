import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  Clock,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderPlus,
  HardDrive,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { api } from '../../api/client'
import { useTenant } from '../../context/TenantContext'
import { DocumentItem } from '../../types/rag'
import { CollectionModal } from './CollectionModal'
import { DocumentDetailModal } from './DocumentDetailModal'
import { DocumentUploadModal } from './DocumentUploadModal'

export const KnowledgeBaseView: React.FC<{
  onOpenUpload: () => void
  isUploadOpen: boolean
  onCloseUpload: () => void
}> = ({ onOpenUpload, isUploadOpen, onCloseUpload }) => {
  const {
    activeTenant,
    collections,
    activeCollectionId,
    setActiveCollectionId,
    refreshCollections,
  } = useTenant()

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchDocs = async (showLoading = true) => {
    if (!activeTenant) return
    if (showLoading) setIsLoading(true)
    try {
      const data = await api.getDocuments(activeTenant.id, activeCollectionId)
      setDocuments(data)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [activeTenant, activeCollectionId])

  // Polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === 'processing' || d.status === 'pending'
    )
    if (!hasProcessing) return

    const interval = setInterval(() => {
      fetchDocs(false)
    }, 2500)

    return () => clearInterval(interval)
  }, [documents, activeTenant, activeCollectionId])

  const handleDelete = async (docId: string, filename: string) => {
    if (!activeTenant) return
    if (!window.confirm(`Are you sure you want to delete "${filename}" and its vector chunks?`)) {
      return
    }

    setDeletingId(docId)
    try {
      await api.deleteDocument(activeTenant.id, docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      refreshCollections()
    } catch (err: any) {
      alert(err.message || 'Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: DocumentItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-success">
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            Ready
          </span>
        )
      case 'processing':
      case 'pending':
        return (
          <span className="badge badge-warning">
            <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            Processing
          </span>
        )
      case 'failed':
        return (
          <span className="badge badge-danger">
            <AlertCircle size={12} />
            Failed
          </span>
        )
      default:
        return <span className="badge badge-info">{status}</span>
    }
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Header with Title & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Knowledge Base
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-format document ingestion, semantic chunking, and BGE-M3 vector indexing for <strong>{activeTenant?.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsCollectionModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <FolderPlus size={16} /> New Collection
          </button>
          <button
            onClick={onOpenUpload}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <UploadCloud size={16} /> Ingest Document
          </button>
        </div>
      </div>

      {/* Collection Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        <button
          onClick={() => setActiveCollectionId(null)}
          style={{
            padding: '6px 14px',
            borderRadius: '9999px',
            background: activeCollectionId === null ? 'var(--accent-primary)' : 'var(--bg-surface)',
            color: activeCollectionId === null ? '#ffffff' : 'var(--text-secondary)',
            border: `1px solid ${activeCollectionId === null ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          All Collections ({documents.length})
        </button>

        {collections.map((c) => {
          const isSelected = activeCollectionId === c.id
          return (
            <button
              key={c.id}
              onClick={() => setActiveCollectionId(c.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {c.name} ({c.document_count ?? 0})
            </button>
          )
        })}
      </div>

      {/* Search & Stats Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '420px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search documents by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div>
            Total Chunks:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {documents.reduce((acc, d) => acc + (d.metadata?.chunk_count || 0), 0)}
            </strong>
          </div>
          <button
            onClick={() => fetchDocs(true)}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
            title="Refresh list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Document Table / List */}
      {isLoading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
          <p>Loading knowledge documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--bg-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <FileText size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Documents Found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
            {searchQuery
              ? 'No documents match your search query.'
              : 'Upload documentation, policy guidelines, or technical specs to start generating grounded AI answers.'}
          </p>
          <button onClick={onOpenUpload} className="btn btn-primary" style={{ marginTop: '8px' }}>
            <UploadCloud size={16} /> Ingest First Document
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>DOCUMENT</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>STATUS</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>CHUNKS</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>SIZE</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>DATE ADDED</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-glow)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.filename}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {d.id.slice(0, 8)}... • {d.mime_type || 'text/plain'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>{getStatusBadge(d.status)}</td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} color="var(--accent-primary)" />
                      <span>{d.metadata?.chunk_count ?? '—'}</span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : 'Text Ingest'}
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>

                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedDocId(d.id)}
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '6px' }}
                        title="View extracted chunks and metadata"
                      >
                        <Eye size={15} /> Inspect
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.filename)}
                        className="btn btn-danger"
                        style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
                        disabled={deletingId === d.id}
                        title="Delete document"
                      >
                        {deletingId === d.id ? (
                          <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={onCloseUpload}
        onSuccess={() => {
          fetchDocs(true)
          refreshCollections()
        }}
      />

      <DocumentDetailModal
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />

      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onSuccess={refreshCollections}
      />
    </div>
  )
}
