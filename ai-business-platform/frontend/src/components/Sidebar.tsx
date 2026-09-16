import React from 'react'
import {
  BookOpen,
  Boxes,
  Cpu,
  FolderTree,
  Layers,
  MessageSquare,
  Sparkles,
} from 'lucide-react'

export type TabType = 'knowledge-base' | 'chat-studio' | 'collections' | 'system-info'

interface SidebarProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  documentCount: number
  collectionCount: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  documentCount,
  collectionCount,
}) => {
  const navItems = [
    {
      id: 'knowledge-base' as TabType,
      label: 'Knowledge Base',
      icon: BookOpen,
      count: documentCount,
    },
    {
      id: 'chat-studio' as TabType,
      label: 'RAG Chat Studio',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      id: 'collections' as TabType,
      label: 'Collections',
      icon: FolderTree,
      count: collectionCount,
    },
    {
      id: 'system-info' as TabType,
      label: 'Pipeline & Latency',
      icon: Cpu,
    },
  ]

  return (
    <aside
      style={{
        width: '260px',
        borderRight: '1px solid var(--border-glass)',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      <div>
        {/* Logo / Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 24px 8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px var(--accent-glow)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AGI Platform
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Enterprise Multi-Tenant RAG
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--bg-surface-active)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-glass-hover)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: isActive ? 'var(--bg-surface)' : 'var(--bg-surface-hover)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {item.count}
                  </span>
                )}

                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--accent-gradient)',
                      color: '#ffffff',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div
        className="glass-panel"
        style={{
          padding: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          <Layers size={14} color="var(--accent-primary)" />
          <span>Local Hybrid Architecture</span>
        </div>
        <div>Embedding: <strong>BGE-M3 (1024d)</strong></div>
        <div>Reranker: <strong>BGE-Base</strong></div>
        <div>Vector DB: <strong>PostgreSQL HNSW</strong></div>
      </div>
    </aside>
  )
}
