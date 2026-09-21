'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSearchParams } from 'next/navigation'

import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Cpu,
  Database,
  History,
  Loader2,
  LogIn,
  Plus,
  Send,
  Star,
  Trash2,
} from 'lucide-react'

import {
  addToWatchlist,
  deleteConversationAction,
  getConversationAction,
  listConversationsAction,
} from '@/app/actions'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button, ButtonLink, Dialog, IconButton } from '@/components/ui'
import { authClient } from '@/lib/auth-client'
import type { AssistantSourceRef, ConversationDTO, ProposedAction } from '@/lib/contracts/assistant'

interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  analysisSource?: 'GEMINI' | 'RULE_BASED' | 'UNAVAILABLE' | null
  sources?: AssistantSourceRef[]
  proposedAction?: ProposedAction | null
  warnings?: string[]
  createdAt?: string
}

function AssistantContent() {
  const searchParams = useSearchParams()

  const tickerParam = (searchParams.get('symbol') || searchParams.get('ticker') || '')
    .trim()
    .toUpperCase()
    .replace(/\.JK$/i, '')
  const initialTicker = /^[A-Z]{4}$/.test(tickerParam) ? tickerParam : ''

  const { data: session, isPending: sessionLoading } = authClient.useSession()

  const [ticker, setTicker] = useState(initialTicker)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Saved conversations modal
  const [convModalOpen, setConvModalOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationDTO[]>([])
  const [loadingConvs, setLoadingConvs] = useState(false)

  // Proposed action confirmation state
  const [confirmingAction, setConfirmingAction] = useState<ProposedAction | null>(null)
  const [executingAction, setExecutingAction] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // Copied message state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Contextual suggestion questions
  const suggestions = useMemo(() => {
    return ticker
      ? [
          `Jelaskan kondisi ${ticker} dengan bahasa sederhana`,
          `Apa arti indikator perhatian untuk ${ticker}?`,
          `Apa yang belum diketahui dari data ${ticker}?`,
        ]
      : [
          'Apa arti rasio P/E dan P/B dalam analisis saham?',
          'Bagaimana cara membaca lonjakan volume (volume spike)?',
          'Apa itu akumulasi dan distribusi broker?',
        ]
  }, [ticker])

  // Load user saved conversations
  const loadConversations = useCallback(async () => {
    if (!session?.user) return
    setLoadingConvs(true)
    const res = await listConversationsAction()
    if (res.success && res.data) {
      setConversations(res.data)
    }
    setLoadingConvs(false)
  }, [session?.user])

  const openSavedConversation = async (id: string) => {
    setLoading(true)
    setError('')
    const res = await getConversationAction(id)
    if (res.success && res.data) {
      setConversationId(res.data.id)
      setTicker(res.data.ticker ?? '')
      const mapped: ChatMessage[] = (res.data.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        analysisSource: m.analysisSource,
        sources: m.sources ?? undefined,
        proposedAction: m.proposedAction ?? null,
      }))
      setMessages(mapped)
      setConvModalOpen(false)
    } else {
      setError(res.error || 'Gagal membuka percakapan.')
    }
    setLoading(false)
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await deleteConversationAction(id)
    if (res.success) {
      if (conversationId === id) {
        setConversationId(undefined)
        setMessages([])
      }
      loadConversations()
    }
  }

  const startNewConversation = () => {
    setConversationId(undefined)
    setMessages([])
    setError('')
    setConvModalOpen(false)
  }

  const sendMessage = async (text = input) => {
    const message = text.trim()
    if (!message || loading) return

    if (!session?.user) {
      setError('Masuk dengan Google terlebih dahulu untuk bertanya ke Asisten RASI.')
      return
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError('')
    setActionSuccess(null)
    setActionError('')

    const requestKey = crypto.randomUUID()

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          ticker: ticker || undefined,
          conversationId,
          requestKey,
        }),
      })

      let payload: {
        conversationId?: string
        messageId?: string
        answer?: string
        sources?: AssistantSourceRef[]
        proposedAction?: ProposedAction | null
        analysisSource?: 'GEMINI' | 'RULE_BASED' | 'UNAVAILABLE'
        warnings?: string[]
        error?: string
      } = {}

      try {
        payload = (await response.json()) as typeof payload
      } catch {
        throw new Error('Gagal membaca respons dari server.')
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Asisten belum dapat menjawab.')
      }

      if (payload.conversationId) {
        setConversationId(payload.conversationId)
      }

      setMessages([
        ...nextMessages,
        {
          id: payload.messageId,
          role: 'assistant',
          content: payload.answer || 'Belum ada jawaban.',
          analysisSource: payload.analysisSource,
          sources: payload.sources,
          proposedAction: payload.proposedAction,
          warnings: payload.warnings,
        },
      ])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Asisten belum dapat menjawab.')
    } finally {
      setLoading(false)
    }
  }

  // Execute confirmed proposed action
  const handleExecuteAction = async () => {
    if (!confirmingAction) return
    setExecutingAction(true)
    setActionError('')
    setActionSuccess(null)

    try {
      if (confirmingAction.type === 'ADD_WATCHLIST' && confirmingAction.ticker) {
        const res = await addToWatchlist({
          ticker: confirmingAction.ticker,
          name: confirmingAction.ticker,
        })
        if (res.success) {
          setActionSuccess(`${confirmingAction.ticker} berhasil ditambahkan ke daftar pantauan.`)
          setConfirmingAction(null)
        } else {
          setActionError(res.error || 'Gagal menyimpan ke pantauan.')
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengeksekusi aksi.')
    } finally {
      setExecutingAction(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-xs">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--rasi-text)]">
                Asisten RASI
              </h1>
              {ticker && (
                <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 font-mono text-xs font-bold">
                  Emiten: {ticker}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--rasi-muted)]">
              {ticker
                ? `Membahas emiten ${ticker} berdasarkan bukti laporan resmi.`
                : 'Membantu menjelaskan indikator dan konsep riset saham dengan bahasa sederhana.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session?.user && (
            <Button
              variant="secondary"
              size="sm"
              icon={History}
              onClick={() => {
                loadConversations()
                setConvModalOpen(true)
              }}
            >
              Percakapan
            </Button>
          )}

          {messages.length > 0 && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={startNewConversation}>
              Percakapan baru
            </Button>
          )}
        </div>
      </div>

      {/* Guest Notice */}
      {!sessionLoading && !session?.user && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/60 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--rasi-text)]">
              Masuk untuk Menggunakan Asisten AI
            </p>
            <p className="text-xs text-[var(--rasi-muted)]">
              Login dengan Google agar riwayat percakapan dan kuota analisis tersimpan pada akun
              Anda.
            </p>
          </div>
          <ButtonLink
            href={`/masuk?callbackURL=${encodeURIComponent(ticker ? `/asisten?symbol=${ticker}` : '/asisten')}`}
            variant="primary"
            size="sm"
            icon={LogIn}
          >
            Masuk dengan Google
          </ButtonLink>
        </div>
      )}

      {/* Main Chat Box */}
      <div className="flex min-h-[500px] flex-col rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] shadow-xs">
        {/* Messages List */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Introductory notice */}
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/40 p-4 text-xs leading-relaxed text-[var(--rasi-muted)]">
            <strong className="text-[var(--rasi-text)]">Tentang Asisten RASI:</strong> Asisten
            membantu menjelaskan laporan dan indikator RASI, namun tidak memberikan rekomendasi
            beli/jual atau kepastian keuntungan. Periksa selalu tanggal data dan sumber laporan
            sebelum mengambil keputusan investasi.
          </div>

          {messages.map((msg, index) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id ?? index}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-tr-xs bg-[var(--rasi-primary)] font-medium text-[var(--rasi-primary-text)]'
                      : 'space-y-3 rounded-tl-xs border border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-text)]'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  {/* Assistant Provenance, Sources, and Warnings */}
                  {!isUser && (
                    <div className="space-y-2 border-t border-[var(--rasi-border)] pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rasi-muted)]">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Cpu className="h-3 w-3" />
                          {msg.analysisSource === 'GEMINI'
                            ? 'Model: Gemini'
                            : 'Analisis: Berbasis Aturan'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id ?? String(index), msg.content)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--rasi-muted)] transition-colors hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]"
                          title="Salin jawaban"
                        >
                          {copiedId === (msg.id ?? String(index)) ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Tersalin
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Warnings if any */}
                      {msg.warnings && msg.warnings.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                          {msg.warnings.map((w, idx) => (
                            <p key={idx} className="flex items-start gap-1">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{w}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="cursor-pointer text-[var(--rasi-muted)]">
                          <summary className="flex list-none items-center gap-1 text-[11px] font-semibold hover:text-[var(--rasi-text)]">
                            <Database className="h-3 w-3" />
                            <span>Sumber data rujukan ({msg.sources.length})</span>
                          </summary>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px]">
                            {msg.sources.map((src, idx) => (
                              <li key={idx}>
                                {src.label} {src.date ? `(${src.date})` : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {/* Proposed Action Confirmation */}
                      {msg.proposedAction && msg.proposedAction.type === 'ADD_WATCHLIST' && (
                        <div className="mt-2 space-y-2 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-active-bg)] p-3">
                          <p className="text-xs font-semibold text-[var(--rasi-text)]">
                            Usulan Asisten: Simpan {msg.proposedAction.ticker} ke pantauan Anda?
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Star}
                              onClick={() => setConfirmingAction(msg.proposedAction ?? null)}
                            >
                              Konfirmasi simpan
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-xs border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 text-xs text-[var(--rasi-muted)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
                <span>Asisten sedang merumuskan jawaban berdasarkan bukti data…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Global errors or action status */}
        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        {actionSuccess && (
          <div
            role="status"
            className="mx-4 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200"
          >
            {actionSuccess}
          </div>
        )}

        {/* Suggestions chips */}
        {messages.length === 0 && (
          <div className="space-y-2 border-t border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/20 p-4">
            <p className="text-[11px] font-semibold text-[var(--rasi-muted)]">
              Pertanyaan yang sering diajukan:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={loading || !session?.user}
                  className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-1.5 text-left text-xs text-[var(--rasi-text)] transition-colors hover:border-[var(--rasi-primary)] hover:text-[var(--rasi-primary)] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex items-center gap-2 border-t border-[var(--rasi-border)] p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || !session?.user}
            placeholder={
              session?.user
                ? ticker
                  ? `Tanyakan tentang ${ticker}…`
                  : 'Tanyakan konsep atau hal yang ingin dipahami…'
                : 'Masuk dengan Google untuk mengirim pertanyaan'
            }
            className="min-h-[44px] flex-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-4 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20 disabled:cursor-not-allowed disabled:bg-[var(--rasi-muted-bg)]"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Send}
            disabled={!input.trim() || loading || !session?.user}
          >
            Kirim
          </Button>
        </form>
      </div>

      {/* Modal 1: Saved Conversations List */}
      <Dialog
        open={convModalOpen}
        onClose={() => setConvModalOpen(false)}
        title="Daftar Percakapan Tersimpan"
        description="Buka kembali percakapan sebelumnya yang tersimpan di akun Anda."
        role="read"
      >
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {loadingConvs ? (
            <div className="py-8 text-center text-xs text-[var(--rasi-muted)]">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
              Memuat percakapan…
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--rasi-muted)]">
              Belum ada percakapan tersimpan di akun Anda.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => openSavedConversation(c.id)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--rasi-border)] p-3 transition-colors hover:border-[var(--rasi-primary)] hover:bg-[var(--rasi-muted-bg)]/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-[var(--rasi-text)]">
                      {c.title || 'Percakapan Riset'}
                    </span>
                    {c.ticker && (
                      <span className="rounded bg-[var(--rasi-muted-bg)] px-1.5 py-0.5 font-mono text-[10px]">
                        {c.ticker}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--rasi-muted)]">
                    {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('id-ID') : 'Terkini'}
                  </span>
                </div>

                <IconButton
                  icon={Trash2}
                  aria-label="Hapus percakapan"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  className="text-[var(--rasi-muted)] hover:text-[var(--rasi-danger)]"
                />
              </div>
            ))
          )}
        </div>
      </Dialog>

      {/* Modal 2: Confirm Proposed Action */}
      <Dialog
        open={Boolean(confirmingAction)}
        onClose={() => setConfirmingAction(null)}
        title="Konfirmasi Tambah Pantauan"
        description="Asisten mengusulkan untuk menyimpan emiten ke daftar pantauan akun Anda."
        role="form"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--rasi-muted)]">
            Apakah Anda ingin menambahkan{' '}
            <strong className="font-mono text-[var(--rasi-text)]">
              {confirmingAction?.ticker}
            </strong>{' '}
            ke daftar pantauan portofolio Anda?
          </p>

          {actionError && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800"
            >
              {actionError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--rasi-border)] pt-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setConfirmingAction(null)}
              disabled={executingAction}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleExecuteAction}
              pending={executingAction}
              pendingText="Menyimpan…"
              icon={Check}
            >
              Ya, simpan ke pantauan
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-[var(--rasi-muted)]">
          Memuat Asisten RASI…
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  )
}
