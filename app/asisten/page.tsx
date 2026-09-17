'use client'

import { useMemo, useState } from 'react'

import { Bot, Loader2, Send, Sparkles } from 'lucide-react'

import { addToWatchlist } from '@/app/actions'
import { ResearchShell } from '@/components/ResearchShell'

type Message = {
  role: 'user' | 'assistant'
  content: string
  source?: string
  action?: { type: string; ticker?: string; label?: string } | null
}

export default function AssistantPage() {
  const [ticker, setTicker] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('symbol') || '')
          .toUpperCase()
          .replace(/\.JK$/i, ''),
  )
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<Message['action']>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const suggestions = useMemo(
    () =>
      ticker
        ? [
            'Jelaskan kondisi ' + ticker + ' dengan bahasa sederhana',
            'Apa yang belum diketahui dari data ini?',
            'Buat catatan pantauan untuk ' + ticker,
          ]
        : [
            'Apa arti P/E dan P/B?',
            'Apa itu akumulasi broker?',
            'Bagaimana cara membaca volume spike?',
          ],
    [ticker],
  )
  const send = async (text = input) => {
    const message = text.trim()
    if (!message || loading) return
    const next = [...messages, { role: 'user' as const, content: message }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, ticker, history: messages }),
      })
      const payload = (await response.json()) as {
        answer?: string
        error?: string
        analysisSource?: string
        proposedAction?: Message['action']
      }
      if (!response.ok) throw new Error(payload.error || 'Asisten belum dapat menjawab.')
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: payload.answer || 'Belum ada jawaban.',
          source: payload.analysisSource,
          action: payload.proposedAction,
        },
      ])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Asisten belum dapat menjawab.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <ResearchShell>
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-h-[620px] rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
          <div className="flex items-center gap-3 border-b border-[var(--rasi-border)] px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-semibold">Asisten RASI</h1>
              <p className="text-xs text-[var(--rasi-muted)]">
                {ticker ? 'Membahas ' + ticker : 'Jelaskan data saham dengan bahasa sederhana'}
              </p>
            </div>
          </div>
          <div className="flex min-h-[470px] flex-col gap-4 p-5">
            <div className="rounded-lg bg-[var(--rasi-muted-bg)] p-4 text-sm leading-6">
              Saya membantu menjelaskan data RASI, tetapi tidak menggantikan keputusan Anda. Sumber
              dan tanggal ditampilkan jika tersedia.
            </div>
            {messages.map((item, index) => (
              <div
                key={index}
                className={
                  'max-w-[88%] rounded-lg p-4 text-sm leading-6 ' +
                  (item.role === 'user'
                    ? 'self-end bg-blue-600 text-white'
                    : 'bg-[var(--rasi-muted-bg)]')
                }
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
                {item.role === 'assistant' && (
                  <>
                    <p className="mt-3 text-[11px] font-semibold tracking-wide text-[var(--rasi-muted)] uppercase">
                      {item.source === 'GEMINI' ? 'Dijawab Gemini' : 'Data lokal / aturan'}
                    </p>
                    {item.action && (
                      <button
                        type="button"
                        className="rasi-button-secondary mt-3"
                        onClick={() => {
                          setActionError('')
                          setPendingAction(item.action)
                        }}
                      >
                        {item.action.label || 'Tinjau usulan aksi'}
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            {loading && (
              <div
                className="flex items-center gap-2 text-sm text-[var(--rasi-muted)]"
                role="status"
              >
                <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa data dan menyusun jawaban…
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                {error}
              </p>
            )}
          </div>
          <form
            className="flex gap-2 border-t border-[var(--rasi-border)] p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <label htmlFor="assistant-message" className="sr-only">
              Pertanyaan
            </label>
            <input
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2000}
              placeholder="Tulis pertanyaan tentang data saham…"
              className="min-h-11 flex-1 rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rasi-button-primary min-h-11 px-4"
              aria-label="Kirim pertanyaan"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
            <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">Konteks</p>
            <input
              value={ticker}
              onChange={(event) =>
                setTicker(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, '')
                    .slice(0, 4),
                )
              }
              placeholder="Contoh BBCA"
              aria-label="Kode saham konteks"
              className="mt-3 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 font-mono text-sm"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--rasi-muted)]">
              Konteks saham dipakai saat mengirim pertanyaan berikutnya.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-blue-600" /> Coba tanyakan
            </div>
            <div className="mt-3 space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="w-full rounded-lg border border-[var(--rasi-border)] px-3 py-2 text-left text-xs leading-5 hover:border-blue-400 hover:bg-[var(--rasi-muted-bg)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-[var(--rasi-muted)]">
            Pesan dibatasi agar layanan tetap hemat kuota. Jangan kirim rahasia atau kredensial.
          </p>
        </aside>
      </section>
      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-action-title"
            className="w-full max-w-md rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5 shadow-xl"
          >
            <h2 id="assistant-action-title" className="text-lg font-semibold">
              Tinjau usulan Asisten
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--rasi-muted)]">
              Asisten mengusulkan menyimpan <strong>{pendingAction.ticker}</strong> ke pantauan.
              Tidak ada perubahan sampai Anda menekan Simpan.
            </p>
            {actionError ? (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                {actionError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rasi-button-secondary justify-center"
                onClick={() => setPendingAction(null)}
                disabled={actionBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="rasi-button-primary justify-center"
                disabled={actionBusy || !pendingAction.ticker}
                onClick={async () => {
                  if (!pendingAction.ticker) return
                  setActionBusy(true)
                  setActionError('')
                  const result = await addToWatchlist({ ticker: pendingAction.ticker })
                  if (result.success) setPendingAction(null)
                  else setActionError(result.error || 'Pantauan belum tersimpan.')
                  setActionBusy(false)
                }}
              >
                {actionBusy ? 'Menyimpan…' : 'Simpan ke pantauan'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ResearchShell>
  )
}
