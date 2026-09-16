import React, { useState, useRef } from 'react'
import {
  FileText,
  Loader2,
  Paperclip,
  Type,
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck
} from 'lucide-react'
import { api } from '../../api/client'
import { useTenant } from '../../context/TenantContext'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeTenant, collections, activeCollectionId } = useTenant()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    activeCollectionId || ''
  )
  const [rawText, setRawText] = useState('')
  const [textFilename, setTextFilename] = useState('notes.txt')
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  if (!isOpen) return null

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
      setErrorMessage(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTenant) {
      setErrorMessage('No active tenant selected.')
      return
    }

    setErrorMessage(null)
    setIsUploading(true)

    try {
      if (mode === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a PDF, DOCX, or TXT file to upload.')
        }
        await api.ingestFile(
          activeTenant.id,
          selectedFile,
          selectedCollectionId || null
        )
      } else {
        if (!rawText.trim()) {
          throw new Error('Please enter text content to ingest.')
        }
        await api.ingestText(
          activeTenant.id,
          rawText.trim(),
          textFilename.trim() || 'document.txt',
          selectedCollectionId || null
        )
      }

      // Reset state and notify parent
      setSelectedFile(null)
      setRawText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Upload error:', err)
      setErrorMessage(err.message || 'Ingestion failed')
    } finally {
      setIsUploading(false)
    }
  }

  const isSubmitDisabled = isUploading || (mode === 'file' && !selectedFile) || (mode === 'text' && !rawText.trim())

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '28px',
          background: 'var(--bg-sidebar)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-glass-hover)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Ingest Knowledge Document
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Tenant: <strong style={{ color: 'var(--text-primary)' }}>{activeTenant?.name || 'Enterprise'}</strong>
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-ghost" 
            style={{ padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('file')
              setErrorMessage(null)
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'file' ? 'var(--bg-surface-active)' : 'transparent',
              color: mode === 'file' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Paperclip size={16} /> Upload File (PDF / DOCX / TXT)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('text')
              setErrorMessage(null)
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'text' ? 'var(--bg-surface-active)' : 'transparent',
              color: mode === 'text' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Type size={16} /> Direct Text / Markdown
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--status-danger)',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Collection Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Assign to Knowledge Collection (Optional)
            </label>
            <select
              className="input-field"
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
            >
              <option value="">-- General Knowledge Base (No Collection) --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {mode === 'file' ? (
            /* File Drag & Drop */
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${
                  selectedFile 
                    ? 'var(--accent-primary)' 
                    : isDragging 
                    ? 'var(--accent-primary)' 
                    : 'var(--border-glass-hover)'
                }`,
                borderRadius: 'var(--radius-lg)',
                padding: '30px 20px',
                textAlign: 'center',
                background: selectedFile 
                  ? 'var(--bg-surface-active)' 
                  : isDragging 
                  ? 'var(--bg-surface-hover)' 
                  : 'var(--bg-surface)',
                cursor: 'pointer',
                marginBottom: '20px',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              
              {selectedFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileCheck size={24} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      {selectedFile.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'var(--accent-glow)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px auto',
                    }}
                  >
                    <UploadCloud size={24} />
                  </div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    Choose a file or drag & drop here
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports PDF (with page detection), DOCX, TXT, and Markdown
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Direct Text Input */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Document Title / Filename
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={textFilename}
                  onChange={(e) => setTextFilename(e.target.value)}
                  placeholder="e.g. refund_policy.txt"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Text Content
                </label>
                <textarea
                  className="input-field"
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste documentation, policy terms, knowledge articles..."
                  style={{ resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}
                  required
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitDisabled}
              style={{ 
                minWidth: '130px',
                opacity: isSubmitDisabled ? 0.6 : 1,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Processing...</span>
                </span>
              ) : (
                'Start Ingestion'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
