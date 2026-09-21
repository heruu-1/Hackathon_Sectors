'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Edit3, Eye, History, Loader2, LogIn, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'

import {
  addToWatchlist,
  deleteWatchlistItem,
  getRecentAnomalies,
  getWatchlist,
  updateWatchlistItem,
} from '@/app/actions'
import { StockPreviewDialog } from '@/components/StockPreviewDialog'
import { WatchlistDeleteDialog } from '@/components/WatchlistDeleteDialog'
import { WatchlistNoteDialog } from '@/components/WatchlistNoteDialog'
import { ActionMenu, Button, ButtonLink } from '@/components/ui'
import type { Anomaly } from '@/db/schema'
import { authClient } from '@/lib/auth-client'

export interface WatchlistCardItem {
  id: number
  ticker: string
  name: string
  targetPrice?: string | number | null
  notes?: string | null
  priority?: string
  status?: string
  lastPrice?: string | number | null
  lastChange?: string | number | null
  updatedAt?: string | Date
  createdAt?: string | Date
}

function WatchlistContent({ initialTab = 'watchlist' }: { initialTab?: 'watchlist' | 'history' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get('tab') as 'watchlist' | 'history' | null
  const [activeTab, setActiveTab] = useState<'watchlist' | 'history'>(() => queryTab ?? initialTab)

  const { data: session, isPending: sessionLoading } = authClient.useSession()

  // Watchlist state
  const [watchlist, setWatchlist] = useState<WatchlistCardItem[]>([])
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [watchlistError, setWatchlistError] = useState('')

  // History state
  const [history, setHistory] = useState<Anomaly[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')

  // Quick add ticker state
  const [newTicker, setNewTicker] = useState('')
  const [addingTicker, setAddingTicker] = useState(false)
  const [addError, setAddError] = useState('')

  // Preview dialog state
  const [previewTicker, setPreviewTicker] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Edit note dialog state
  const [noteItem, setNoteItem] = useState<WatchlistCardItem | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)

  // Delete dialog state
  const [deleteItem, setDeleteItem] = useState<WatchlistCardItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const switchTab = (tab: 'watchlist' | 'history') => {
    setActiveTab(tab)
    router.replace(`/watchlist?tab=${tab}`, { scroll: false })
  }

  // Load watchlist
  const loadWatchlist = useCallback(() => {
    setLoadingWatchlist(true)
    setWatchlistError('')
    getWatchlist()
      .then((res) => {
        if (res.data) {
          setWatchlist(res.data)
        } else if (res.error) {
          setWatchlistError(res.error)
        }
      })
      .catch((err) => {
        setWatchlistError(err instanceof Error ? err.message : 'Gagal memuat pantauan.')
      })
      .finally(() => setLoadingWatchlist(false))
  }, [])

  // Load history
  const loadHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError('')
    getRecentAnomalies()
      .then((res) => {
        if (res.data) {
          setHistory(res.data)
        } else if (res.error) {
          setHistoryError(res.error)
        }
      })
      .catch((err) => {
        setHistoryError(err instanceof Error ? err.message : 'Gagal memuat riwayat.')
      })
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      loadWatchlist()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadWatchlist])

  useEffect(() => {
    if (activeTab === 'history') {
      let isMounted = true
      const timer = window.setTimeout(() => {
        if (!isMounted) return
        loadHistory()
      }, 0)
      return () => {
        isMounted = false
        window.clearTimeout(timer)
      }
    }
  }, [activeTab, loadHistory])

  // Quick add stock to watchlist
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const ticker = newTicker.trim().toUpperCase().replace(/\.JK$/i, '')
    if (!/^[A-Z]{4}$/.test(ticker)) {
      setAddError('Kode saham harus berupa 4 huruf IDX.')
      return
    }

    setAddingTicker(true)
    setAddError('')

    const res = await addToWatchlist({ ticker, name: ticker })
    if (res.success && res.data) {
      setNewTicker('')
      loadWatchlist()
    } else {
      setAddError(res.error || 'Gagal menambahkan ke pantauan. Pastikan sudah login.')
    }
    setAddingTicker(false)
  }

  const handleSaveNote = async (id: number, notes: string) => {
    const res = await updateWatchlistItem(id, { notes })
    if (res.success) {
      loadWatchlist()
      return true
    }
    return false
  }

  const handleDeleteItem = async (id: number) => {
    const res = await deleteWatchlistItem(id)
    if (res.success) {
      loadWatchlist()
      return true
    }
    return false
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header & Tabs */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pantauan & Riwayat</h1>
          <p className="mt-1 text-sm text-[var(--rasi-muted)]">
            Kelola emiten yang Anda ikuti dan telusuri analisis yang pernah Anda buka.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-1">
          <button
            type="button"
            onClick={() => switchTab('watchlist')}
            className={`flex min-h-[36px] items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
              activeTab === 'watchlist'
                ? 'bg-[var(--rasi-surface)] text-[var(--rasi-text)] shadow-xs'
                : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Daftar Pantauan ({watchlist.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('history')}
            className={`flex min-h-[36px] items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-[var(--rasi-surface)] text-[var(--rasi-text)] shadow-xs'
                : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Riwayat Riset
          </button>
        </div>
      </div>

      {/* Guest notice if not logged in */}
      {!sessionLoading && !session?.user && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/60 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--rasi-text)]">
              Simpan pantauan ke akun Anda
            </p>
            <p className="text-xs text-[var(--rasi-muted)]">
              Masuk dengan akun Google agar daftar pantauan dan catatan pribadi tersimpan aman.
            </p>
          </div>
          <ButtonLink href="/masuk?callbackURL=/watchlist" variant="primary" size="sm" icon={LogIn}>
            Masuk dengan Google
          </ButtonLink>
        </div>
      )}

      {/* TAB 1: WATCHLIST */}
      {activeTab === 'watchlist' && (
        <div className="space-y-6">
          {/* Quick Add Form */}
          <form
            onSubmit={handleQuickAdd}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3"
          >
            <label htmlFor="quick-add-ticker" className="sr-only">
              Kode saham
            </label>
            <input
              id="quick-add-ticker"
              type="text"
              maxLength={4}
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="Tambah kode saham (contoh: BBCA)"
              className="min-h-[44px] flex-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] uppercase outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              pending={addingTicker}
              pendingText="Menambahkan…"
              icon={Plus}
            >
              Simpan ke pantauan
            </Button>
          </form>

          {addError && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
            >
              {addError}
            </p>
          )}

          {/* Watchlist Items */}
          {loadingWatchlist ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
              Memuat daftar pantauan…
            </div>
          ) : watchlistError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
            >
              {watchlistError}
            </div>
          ) : watchlist.length === 0 ? (
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-12 text-center text-sm text-[var(--rasi-muted)]">
              <Star className="mx-auto mb-2 h-8 w-8 text-[var(--rasi-muted)]" aria-hidden="true" />
              <p className="font-semibold text-[var(--rasi-text)]">Belum ada saham di pantauan</p>
              <p className="mt-1 text-xs">
                Tambahkan kode saham di atas atau klik tombol &quot;Simpan ke pantauan&quot; di
                halaman detail saham.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 transition-colors hover:border-[var(--rasi-primary)]/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/saham/${item.ticker}`}
                        className="font-mono text-lg font-bold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                      >
                        {item.ticker}
                      </Link>
                      <span className="truncate text-sm text-[var(--rasi-text)]">{item.name}</span>
                    </div>

                    {item.notes ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-[var(--rasi-muted)]">
                        {item.notes}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--rasi-muted)]/70 italic">
                        Belum ada catatan riset.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => {
                        setPreviewTicker(item.ticker)
                        setPreviewOpen(true)
                      }}
                    >
                      Ringkasan
                    </Button>

                    <ActionMenu
                      aria-label={`Pilihan untuk ${item.ticker}`}
                      items={[
                        {
                          label: 'Edit catatan',
                          icon: Edit3,
                          onClick: () => {
                            setNoteItem(item)
                            setNoteOpen(true)
                          },
                        },
                        {
                          label: 'Hapus dari pantauan',
                          icon: Trash2,
                          variant: 'destructive',
                          onClick: () => {
                            setDeleteItem(item)
                            setDeleteOpen(true)
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--rasi-muted)]">
              Snapshot analisis publik yang tersimpan di database.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadHistory}
              pending={loadingHistory}
              pendingText="Menyegarkan…"
              icon={RefreshCw}
            >
              Perbarui riwayat
            </Button>
          </div>

          {loadingHistory ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
              Memuat riwayat riset…
            </div>
          ) : historyError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
            >
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-12 text-center text-sm text-[var(--rasi-muted)]">
              <History
                className="mx-auto mb-2 h-8 w-8 text-[var(--rasi-muted)]"
                aria-hidden="true"
              />
              <p className="font-semibold text-[var(--rasi-text)]">Belum ada riwayat analisis</p>
              <p className="mt-1 text-xs">
                Buat analisis mendalam pada halaman detail saham untuk menyimpan snapshot riwayat.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 transition-colors hover:border-[var(--rasi-primary)]/40 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/saham/${row.ticker}`}
                        className="font-mono text-lg font-bold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                      >
                        {row.ticker}
                      </Link>
                      <span className="text-sm font-medium text-[var(--rasi-text)]">
                        {row.name}
                      </span>
                      <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold">
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                      Tanggal data: {row.priceDate ?? '—'} • Disimpan:{' '}
                      {new Date(row.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <ButtonLink href={`/saham/${row.ticker}`} variant="secondary" size="sm">
                      Buka hasil analisis
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <StockPreviewDialog
        ticker={previewTicker}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <WatchlistNoteDialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        item={noteItem}
        onSave={handleSaveNote}
      />

      <WatchlistDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        item={deleteItem}
        onConfirm={handleDeleteItem}
      />
    </div>
  )
}

export default function WatchlistPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--rasi-muted)]">
          Memuat halaman pantauan…
        </div>
      }
    >
      <WatchlistContent />
    </Suspense>
  )
}
