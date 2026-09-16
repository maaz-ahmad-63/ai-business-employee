import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Bot,
  Clock,
  Cpu,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import { api } from '../../api/client'
import { useTenant } from '../../context/TenantContext'
import { ChatMessage, CitationSource, Conversation } from '../../types/rag'
import { CitationDrawer } from './CitationDrawer'
import {
  ChatRetrievalSettings,
  RetrievalSettingsModal,
} from './RetrievalSettingsModal'

export const RAGChatStudio: React.FC = () => {
  const { activeTenant, collections, activeCollectionId } = useTenant()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Citations & Settings Modals
  const [selectedCitationSources, setSelectedCitationSources] = useState<CitationSource[]>([])
  const [selectedCitationIndex, setSelectedCitationIndex] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Retrieval Settings
  const [settings, setSettings] = useState<ChatRetrievalSettings>({
    topK: 5,
    rerank: true,
    collectionId: activeCollectionId,
    llmProvider: 'mock',
    llmModel: '',
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load conversations
  useEffect(() => {
    if (!activeTenant) return

    const loadConversations = async () => {
      try {
        const list = await api.getConversations(activeTenant.id)
        setConversations(list)
        if (list.length > 0 && !activeConversationId) {
          setActiveConversationId(list[0].id)
        } else if (list.length === 0) {
          // Create initial conversation session
          const newConv = await api.createConversation(
            activeTenant.id,
            'Knowledge Exploration'
          )
          setConversations([newConv])
          setActiveConversationId(newConv.id)
        }
      } catch (err) {
        console.error('Failed to load conversations:', err)
      }
    }

    loadConversations()
  }, [activeTenant])

  // Load messages for active conversation
  useEffect(() => {
    if (!activeTenant || !activeConversationId) return

    const loadMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const msgs = await api.getMessages(activeTenant.id, activeConversationId)
        setMessages(msgs)
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [activeTenant, activeConversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  const handleNewConversation = async () => {
    if (!activeTenant) return
    try {
      const conv = await api.createConversation(activeTenant.id, 'New Chat')
      setConversations((prev) => [conv, ...prev])
      setActiveConversationId(conv.id)
      setMessages([])
    } catch (err) {
      console.error('Failed to create new conversation:', err)
    }
  }

  const handleSendMessage = async (queryText?: string) => {
    const q = queryText || inputQuery.trim()
    if (!q || !activeTenant || isSending) return

    // Ensure we have an active conversation
    let currentConvId = activeConversationId
    if (!currentConvId) {
      const newConv = await api.createConversation(activeTenant.id, q.slice(0, 30))
      setConversations((prev) => [newConv, ...prev])
      setActiveConversationId(newConv.id)
      currentConvId = newConv.id
    }

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      tenant_id: activeTenant.id,
      conversation_id: currentConvId,
      role: 'user',
      content: q,
      created_at: Date.now(),
    }
    setMessages((prev) => [...prev, tempUserMsg])
    setInputQuery('')
    setIsSending(true)

    try {
      const res = await api.sendMessage(activeTenant.id, currentConvId, q, {
        topK: settings.topK,
        collectionId: settings.collectionId,
        llmProvider: settings.llmProvider,
        llmModel: settings.llmModel || undefined,
      })

      // Replace optimistic message with actual persisted response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        res.user_message,
        res.assistant_message,
      ])
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        tenant_id: activeTenant.id,
        conversation_id: currentConvId,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to retrieve response from RAG backend.'}`,
        created_at: Date.now(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  const openCitationInspector = (sources: CitationSource[], index: number = 0) => {
    setSelectedCitationSources(sources)
    setSelectedCitationIndex(index)
  }

  const suggestionQueries = [
    'What are the return and refund policies?',
    'Summarize the key capabilities of our platform.',
    'Explain the vector indexing architecture.',
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', overflow: 'hidden' }}>
      {/* Left Conversations Sidebar */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid var(--border-glass)',
          background: 'var(--bg-app)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
        }}
      >
        <button
          onClick={handleNewConversation}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginBottom: '14px', fontSize: '0.85rem' }}
        >
          <Plus size={16} /> New Chat Session
        </button>

        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px 8px 8px', textTransform: 'uppercase' }}>
          CONVERSATION SESSIONS
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--bg-surface-active)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-glass-hover)' : '1px solid transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <MessageSquare size={14} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title || 'Conversation'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Chat Thread Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-sidebar)', position: 'relative' }}>
        {/* Top Control Bar */}
        <div
          style={{
            height: '52px',
            borderBottom: '1px solid var(--border-glass)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>RAG Query Studio</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Collection: <strong>{collections.find((c) => c.id === settings.collectionId)?.name || 'All Documents'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-active)',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
              }}
            >
              top_k={settings.topK} • reranker={settings.rerank ? 'ON' : 'OFF'} • llm={settings.llmProvider}
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
              title="Configure Retrieval Parameters"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoadingMessages ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px auto' }} />
              <p style={{ fontSize: '0.85rem' }}>Loading conversation history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '16px',
                color: 'var(--text-muted)',
                padding: '40px 20px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--accent-glow)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 24px var(--accent-glow)',
                }}
              >
                <Sparkles size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Enterprise RAG Chat Studio
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '480px', marginTop: '6px' }}>
                  Ask questions against your ingested documents. Answers are strictly grounded in vector & keyword matches with verified source citations.
                </p>
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '420px', marginTop: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  SUGGESTED QUERIES
                </span>
                {suggestionQueries.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sq)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.825rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-glass)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    💬 {sq}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user'
              const sources = m.metadata?.sources || []
              const latencies = m.metadata?.latencies_ms || {}

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: isUser ? '75%' : '85%',
                  }}
                >
                  {!isUser && (
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
                        flexShrink: 0,
                        boxShadow: '0 2px 8px var(--accent-glow)',
                      }}
                    >
                      <Bot size={18} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isUser ? 'var(--accent-primary)' : 'var(--bg-surface)',
                        color: isUser ? '#ffffff' : 'var(--text-primary)',
                        border: isUser ? 'none' : '1px solid var(--border-glass)',
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {m.content}
                    </div>

                    {/* Sources & Citations Bar for Assistant Message */}
                    {!isUser && sources.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Sources:
                        </span>
                        {sources.map((s, sIdx) => (
                          <button
                            key={s.chunk_id || sIdx}
                            onClick={() => openCitationInspector(sources, sIdx)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-surface-active)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Click to inspect source chunk context"
                          >
                            <FileText size={12} />
                            <span>
                              [{s.source_id}] {s.filename || 'Doc'}
                              {s.page ? ` (p.${s.page})` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Latency Profiler for Assistant Message */}
                    {!isUser && latencies && Object.keys(latencies).length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <Zap size={11} color="var(--status-warning)" />
                        <span>
                          {latencies.total_ms ? `${latencies.total_ms}ms` : 'Processed'} (
                          {latencies.embedding_ms ? `emb: ${latencies.embedding_ms}ms | ` : ''}
                          {latencies.vector_ms ? `vec: ${latencies.vector_ms}ms | ` : ''}
                          {latencies.fts_ms ? `fts: ${latencies.fts_ms}ms | ` : ''}
                          {latencies.rerank_ms ? `rerank: ${latencies.rerank_ms}ms` : ''}
                          )
                        </span>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface-active)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)',
                        flexShrink: 0,
                      }}
                    >
                      <User size={18} />
                    </div>
                  )}
                </div>
              )
            })
          )}

          {isSending && (
            <div style={{ display: 'flex', gap: '14px', alignSelf: 'flex-start' }}>
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
                }}
              >
                <Bot size={18} />
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Running hybrid vector + FTS search & CrossEncoder reranking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-glass)',
            background: 'var(--bg-surface)',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
          >
            <input
              type="text"
              className="input-field"
              placeholder={`Ask any question against ${activeTenant?.name}'s knowledge base...`}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isSending}
              style={{ flex: 1, padding: '12px 18px', fontSize: '0.9rem' }}
              autoFocus
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSending || !inputQuery.trim()}
              style={{ padding: '12px 20px', minWidth: '90px' }}
            >
              {isSending ? (
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Send size={16} /> Ask
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Citation Inspector Drawer */}
      <CitationDrawer
        sources={selectedCitationSources}
        selectedSourceIndex={selectedCitationIndex}
        onClose={() => setSelectedCitationIndex(null)}
        onSelectSource={(idx) => setSelectedCitationIndex(idx)}
      />

      {/* Retrieval Tuning Settings Modal */}
      <RetrievalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
      />
    </div>
  )
}
