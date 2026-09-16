import React, { useState } from 'react'
import {
  BookOpen,
  FolderPlus,
  FolderTree,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTenant } from '../../context/TenantContext'
import { CollectionModal } from '../KnowledgeBase/CollectionModal'

export const CollectionsView: React.FC<{ onSelectCollection: (id: string) => void }> = ({
  onSelectCollection,
}) => {
  const { collections, activeTenant, deleteExistingCollection, refreshCollections } =
    useTenant()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (colId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete collection "${name}"?`)) return
    setDeletingId(colId)
    try {
      await deleteExistingCollection(colId)
    } catch (err: any) {
      alert(err.message || 'Failed to delete collection')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Knowledge Collections
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Partition enterprise knowledge into dedicated domain taxonomies for <strong>{activeTenant?.name}</strong>.
          </p>
        </div>

        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
          <FolderPlus size={16} /> New Collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <FolderTree size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Custom Collections Yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '8px auto 16px auto' }}>
            Create collections to partition documents into categories like Legal, Engineering, HR, or Marketing.
          </p>
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Create First Collection
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {collections.map((c) => (
            <div
              key={c.id}
              className="glass-panel"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--accent-glow)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FolderTree size={20} />
                  </div>

                  <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                    {c.document_count ?? 0} Documents
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {c.name}
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '6px', minHeight: '38px' }}>
                  {c.description || 'General knowledge collection.'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '14px',
                }}
              >
                <button
                  onClick={() => onSelectCollection(c.id)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <BookOpen size={14} /> View Documents
                </button>

                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="btn btn-danger"
                  style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
                  disabled={deletingId === c.id}
                  title="Delete collection"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CollectionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refreshCollections}
      />
    </div>
  )
}
