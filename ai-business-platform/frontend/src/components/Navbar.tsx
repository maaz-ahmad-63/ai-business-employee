import React, { useState } from 'react'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Database,
  Moon,
  Plus,
  Server,
  Sun,
  XCircle,
} from 'lucide-react'
import { useTenant } from '../context/TenantContext'

export const Navbar: React.FC<{ onOpenUpload: () => void }> = ({ onOpenUpload }) => {
  const {
    tenants,
    activeTenant,
    setActiveTenantId,
    createNewTenant,
    health,
    theme,
    toggleTheme,
  } = useTenant()

  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [isCreatingTenant, setIsCreatingTenant] = useState(false)

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTenantName.trim()) return
    try {
      await createNewTenant(newTenantName.trim())
      setNewTenantName('')
      setIsCreatingTenant(false)
      setIsTenantDropdownOpen(false)
    } catch (err: any) {
      alert(err.message || 'Failed to create tenant')
    }
  }

  const isHealthy = health?.status === 'healthy'

  return (
    <header
      style={{
        height: '64px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left: Tenant Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
        <div
          onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            {activeTenant?.name ? activeTenant.name.charAt(0).toUpperCase() : 'T'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1 }}>
              Active Tenant
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeTenant?.name || 'Select Tenant'}
            </span>
          </div>
          <ChevronDown size={16} color="var(--text-muted)" />
        </div>

        {/* Dropdown Menu */}
        {isTenantDropdownOpen && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              position: 'absolute',
              top: '50px',
              left: 0,
              width: '280px',
              padding: '8px',
              zIndex: 100,
              background: 'var(--bg-sidebar)',
            }}
          >
            <div style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              ORGANIZATION / TENANT
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {tenants.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTenantId(t.id)
                    setIsTenantDropdownOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: t.id === activeTenant?.id ? 'var(--bg-surface-active)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: t.id === activeTenant?.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: t.id === activeTenant?.id ? 600 : 400,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} />
                    <span>{t.name}</span>
                  </div>
                  {t.id === activeTenant?.id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '6px', paddingTop: '6px' }}>
              {isCreatingTenant ? (
                <form onSubmit={handleCreateTenant} style={{ padding: '6px' }}>
                  <input
                    type="text"
                    placeholder="Company name..."
                    className="input-field"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    autoFocus
                    style={{ marginBottom: '8px', padding: '6px 10px', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}>
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setIsCreatingTenant(false)}
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsCreatingTenant(true)}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', gap: '8px' }}
                >
                  <Plus size={14} /> Add New Company Tenant
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions, Health, Theme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Backend Health indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            background: isHealthy ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: isHealthy ? 'var(--status-success)' : 'var(--status-danger)',
          }}
          title={`DB: ${health?.database || 'disconnected'} | Embedding: ${health?.embedding_model || 'BGE-M3'} | Reranker: ${health?.reranker_model || 'BGE-Reranker'}`}
        >
          {isHealthy ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span>{isHealthy ? 'RAG Engine Online' : 'Engine Offline'}</span>
        </div>

        {/* Upload Action */}
        <button
          onClick={onOpenUpload}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Plus size={16} /> Ingest Document
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn btn-ghost"
          style={{ width: '38px', height: '38px', padding: 0, borderRadius: 'var(--radius-md)' }}
          title="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
