import React, { useEffect, useRef, useState } from 'react'
import {
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  Sparkles,
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

// Rich Markdown and Interactive Citation Formatter
const FormattedMessage: React.FC<{
  content: string
  sources: CitationSource[]
  onCitationClick: (sourceIndex: number) => void
}> = ({ content, sources, onCitationClick }) => {
  const lines = content.split('\n')

  const renderFormattedLine = (line: string, lineKey: number) => {
    // 1. Heading 3 or 📌 Section
    if (line.startsWith('### ') || line.startsWith('📌 ')) {
      const headingText = line.replace(/^(###\s*|📌\s*)/, '')
      return (
        <h4
          key={lineKey}
          style={{
            fontSize: '0.98rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '12px',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {renderInlineTokens(headingText)}
        </h4>
      )
    }

    // 2. Bullet point line
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      const bulletText = line.replace(/^([•\-*]\s*)/, '')
      return (
        <div
          key={lineKey}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '4px 0',
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              marginTop: '8px',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>{renderInlineTokens(bulletText)}</div>
        </div>
      )
    }

    // 3. Regular paragraph
    if (!line.trim()) {
      return <div key={lineKey} style={{ height: '8px' }} />
    }

    return (
      <p key={lineKey} style={{ margin: '4px 0', lineHeight: 1.6 }}>
        {renderInlineTokens(line)}
      </p>
    )
  }

  const renderInlineTokens = (text: string) => {
    // Split by bracket citations: [Source X] or [X]
    const tokenRegex = /(\[Source\s*\d+\]|\[\d+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g
    const parts = text.split(tokenRegex)

    return parts.map((part, pIdx) => {
      if (!part) return null

      // Citation pill match
      const sourceMatch = part.match(/\[(?:Source\s*)?(\d+)\]/)
      if (sourceMatch) {
        const sourceNum = parseInt(sourceMatch[1], 10)
        // Find index in sources
        const foundIdx = sources.findIndex((s) => s.source_id === sourceNum)
        const targetIdx = foundIdx !== -1 ? foundIdx : sourceNum - 1

        return (
          <button
            key={pIdx}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCitationClick(Math.max(0, targetIdx))
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 6px',
              margin: '0 3px',
              borderRadius: '4px',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              verticalAlign: 'baseline',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s ease',
            }}
            title="Click to view verified source chunk"
          >
            <FileText size={10} />
            <span>[{sourceNum}]</span>
          </button>
        )
      }

      // Bold text match
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {part.slice(2, -2)}
          </strong>
        )
      }

      // Italic text match
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={pIdx} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            {part.slice(1, -1)}
          </em>
        )
      }

      return <span key={pIdx}>{part}</span>
    })
  }

  return <div>{lines.map((l, i) => renderFormattedLine(l, i))}</div>
}

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
    apiKey: '',
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
        apiKey: settings.apiKey || undefined,
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
    'What is the syllabus and theory topics for this course?',
    'What are the course objectives and prerequisites?',
    'Summarize the key capabilities and structure of the document.',
  ]

  const activeCollectionName = collections.find((c) => c.id === settings.collectionId)?.name || 'All Documents'

  const getProviderBadgeText = () => {
    if (settings.llmProvider === 'mock') return 'Local Synthesizer'
    if (settings.llmProvider === 'gemini') return 'Gemini 1.5'
    if (settings.llmProvider === 'openai') return 'OpenAI'
    if (settings.llmProvider === 'groq') return 'Groq Llama-3'
    if (settings.llmProvider === 'ollama') return 'Ollama'
    return settings.llmProvider
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              RAG Query Studio
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Collection: <strong style={{ color: 'var(--text-secondary)' }}>{activeCollectionName}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-glass)',
                color: 'var(--accent-primary)',
                fontWeight: 600,
              }}
            >
              top_k={settings.topK} • reranker={settings.rerank ? 'ON' : 'OFF'} • engine={getProviderBadgeText()}
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
              title="Configure Retrieval Parameters & LLM"
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '460px', marginTop: '12px' }}>
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
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {isUser ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      ) : (
                        <FormattedMessage
                          content={m.content}
                          sources={sources}
                          onCitationClick={(idx) => openCitationInspector(sources, idx)}
                        />
                      )}
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
                          gap: '10px',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                          <Zap size={11} />
                          <span>{latencies.total_ms || 0}ms</span>
                        </div>
                        {latencies.embedding_ms !== undefined && <span>emb: {latencies.embedding_ms}ms</span>}
                        {latencies.vector_ms !== undefined && <span>vec: {latencies.vector_ms}ms</span>}
                        {latencies.fts_ms !== undefined && <span>fts: {latencies.fts_ms}ms</span>}
                        {latencies.rerank_ms !== undefined && <span>rerank: {latencies.rerank_ms}ms</span>}
                        {latencies.llm_ms !== undefined && <span>llm: {latencies.llm_ms}ms</span>}
                      </div>
                    )}
                  </div>
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
                <span>Searching vector space & synthesizing answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Box */}
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
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={`Ask any question against ${activeTenant?.name || 'knowledge base'}...`}
              disabled={isSending}
              style={{ flex: 1, padding: '12px 18px', fontSize: '0.9rem' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSending || !inputQuery.trim()}
              style={{ padding: '12px 20px', fontSize: '0.9rem' }}
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Send size={16} /> Ask
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Slide-over Citation Drawer */}
      <CitationDrawer
        sources={selectedCitationSources}
        selectedSourceIndex={selectedCitationIndex}
        onClose={() => {
          setSelectedCitationSources([])
          setSelectedCitationIndex(null)
        }}
        onSelectSource={(idx) => setSelectedCitationIndex(idx)}
      />

      {/* Retrieval Settings Modal */}
      <RetrievalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
      />
    </div>
  )
}
