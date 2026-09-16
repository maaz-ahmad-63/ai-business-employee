import React from 'react'
import {
  Key,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react'
import { useTenant } from '../../context/TenantContext'

export interface ChatRetrievalSettings {
  topK: number
  rerank: boolean
  collectionId: string | null
  llmProvider: string
  llmModel: string
  apiKey?: string
}

interface RetrievalSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: ChatRetrievalSettings
  onSaveSettings: (settings: ChatRetrievalSettings) => void
}

export const RetrievalSettingsModal: React.FC<RetrievalSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const { collections } = useTenant()
  const [tempSettings, setTempSettings] = React.useState<ChatRetrievalSettings>(settings)

  React.useEffect(() => {
    setTempSettings(settings)
  }, [settings, isOpen])

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSaveSettings(tempSettings)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '24px',
          background: 'var(--bg-sidebar)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-glass-hover)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
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
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>RAG Pipeline Settings</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Configure retrieval parameters, reranking, and synthesis model
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top K */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Top K Context Chunks
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {tempSettings.topK}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={tempSettings.topK}
              onChange={(e) => setTempSettings({ ...tempSettings, topK: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>1 (Concise)</span>
              <span>5 (Recommended)</span>
              <span>20 (Comprehensive)</span>
            </div>
          </div>

          {/* Collection Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Knowledge Collection Filter
            </label>
            <select
              className="input-field"
              value={tempSettings.collectionId || ''}
              onChange={(e) => setTempSettings({ ...tempSettings, collectionId: e.target.value || null })}
            >
              <option value="">All Tenant Documents</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* CrossEncoder Reranker Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Cross-Encoder Reranker (BGE-Reranker-Base)
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Neural attention relevance scoring on top 20 candidate chunks
              </div>
            </div>
            <input
              type="checkbox"
              checked={tempSettings.rerank}
              onChange={(e) => setTempSettings({ ...tempSettings, rerank: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* LLM Provider Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Answer Generation Engine
            </label>
            <select
              className="input-field"
              value={tempSettings.llmProvider}
              onChange={(e) => setTempSettings({ ...tempSettings, llmProvider: e.target.value })}
            >
              <option value="mock">Local Extractive Synthesizer (Zero API Key, Instant)</option>
              <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
              <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
              <option value="groq">Groq (Llama 3.3 70B - Ultra Fast)</option>
              <option value="ollama">Local Ollama (Llama 3.2 on localhost:11434)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
            </select>
          </div>

          {/* Optional API Key Input if external provider */}
          {tempSettings.llmProvider !== 'mock' && tempSettings.llmProvider !== 'ollama' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Key size={14} /> Optional API Key (leave empty if set in backend .env)
              </label>
              <input
                type="password"
                className="input-field"
                placeholder={`Enter your ${tempSettings.llmProvider.toUpperCase()} API key...`}
                value={tempSettings.apiKey || ''}
                onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Apply Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
