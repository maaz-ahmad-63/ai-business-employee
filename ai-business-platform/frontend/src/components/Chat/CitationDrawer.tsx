import React from 'react'
import {
  Award,
  BookOpen,
  Check,
  FileText,
  Hash,
  Layers,
  Sparkles,
  X,
} from 'lucide-react'
import { CitationSource } from '../../types/rag'

interface CitationDrawerProps {
  sources: CitationSource[]
  selectedSourceIndex: number | null
  onClose: () => void
  onSelectSource: (index: number) => void
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  sources,
  selectedSourceIndex,
  onClose,
  onSelectSource,
}) => {
  if (selectedSourceIndex === null || sources.length === 0) return null

  const activeCitation = sources[selectedSourceIndex] || sources[0]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '780px',
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
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Supporting Source Grounding</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Retrieved via BGE-M3 HNSW Vector + PostgreSQL GIN FTS + CrossEncoder
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Source Tab Selector */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-glass)',
            overflowX: 'auto',
          }}
        >
          {sources.map((s, idx) => {
            const isSelected = idx === selectedSourceIndex
            return (
              <button
                key={idx}
                onClick={() => onSelectSource(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileText size={14} />
                <span>
                  Source {s.source_id}: {s.filename || 'Document'}
                </span>
                {s.page && <span style={{ opacity: 0.8 }}>(p. {s.page})</span>}
              </button>
            )
          })}
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Metadata Card */}
          <div
            className="glass-panel"
            style={{
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)' }}>DOCUMENT:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {activeCitation.filename || 'Direct Ingestion'}
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>PAGE REFERENCE:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {activeCitation.page ? `Page ${activeCitation.page}` : 'N/A (Text / Section)'}
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>CHUNK IDENTIFIER:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                {activeCitation.chunk_id.slice(0, 14)}...
              </div>
            </div>
          </div>

          {/* Extracted Chunk Content */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Sparkles size={16} color="var(--accent-primary)" />
              <span>Exact Retrieved Grounding Text</span>
            </div>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {activeCitation.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
