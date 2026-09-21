'use client'

import { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'

import { AlertTriangle, Eye, Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { type MarketRadarData, getMarketRadarFeed } from '@/app/actions'
import { StockPreviewDialog } from '@/components/StockPreviewDialog'
import { Button } from '@/components/ui'

export default function RadarPage() {
  const [data, setData] = useState<MarketRadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewTicker, setPreviewTicker] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const loadFeed = useCallback(() => {
    setLoading(true)
    setError('')
    getMarketRadarFeed()
      .then((res) => {
        if (res.data) {
          setData(res.data)
        } else {
          setError('Data radar pasar belum tersedia saat ini.')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat radar pasar.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      loadFeed()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadFeed])

  const openPreview = (ticker: string) => {
    setPreviewTicker(ticker)
    setPreviewOpen(true)
  }

  const sleepingGiants = data?.sleepingGiants ?? []
  const insiderAlerts = data?.insiderAlerts ?? []

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--rasi-primary)]">Radar Pasar</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Peristiwa penting dan anomali pasar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--rasi-muted)]">
            Memantau katalis berita yang belum sepenuhnya direspons harga dan pelaporan transaksi
            orang dalam terkini di BEI.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadFeed}
          pending={loading}
          pendingText="Memindai…"
          icon={RefreshCw}
        >
          Perbarui radar
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Section 1: Katalis Berita & Divergensi Harga */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--rasi-primary)]" aria-hidden="true" />
          <h2 className="text-lg font-bold tracking-tight">Katalis Berita dan Divergensi Harga</h2>
        </div>
        <p className="text-xs text-[var(--rasi-muted)]">
          Emiten dengan berita berdampak positif namun pergerakan harga pasar masih tertinggal.
        </p>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
            Memindai berita terkini…
          </div>
        ) : sleepingGiants.length === 0 ? (
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
            Tidak ada divergensi berita ekstrem yang terdeteksi pada data terkini.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sleepingGiants.map((item, idx) => (
              <article
                key={`${item.ticker}-${idx}`}
                className="flex flex-col justify-between rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5 transition-colors hover:border-[var(--rasi-primary)]/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/saham/${item.ticker}`}
                      className="font-mono text-xl font-bold tracking-tight text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                    >
                      {item.ticker}
                    </Link>
                    <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rasi-text)]">
                      Katalis: {item.sentiment}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPreview(item.ticker)}
                    className="mt-3 text-left text-sm leading-snug font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                  >
                    {item.headline}
                  </button>

                  <p className="mt-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
                    {item.verdict}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--rasi-border)] pt-3 text-xs text-[var(--rasi-muted)]">
                  <span>Sumber: Sectors News</span>
                  <div className="flex items-center gap-3">
                    <span>{item.timestamp?.split('T')[0] ?? 'Terkini'}</span>
                    <button
                      type="button"
                      onClick={() => openPreview(item.ticker)}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Pratinjau
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Transaksi Orang Dalam */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="h-5 w-5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold tracking-tight">
            Pelaporan Transaksi Orang Dalam Terkini
          </h2>
        </div>
        <p className="text-xs text-[var(--rasi-muted)]">
          Perubahan porsi kepemilikan oleh direksi, komisaris, atau pemegang saham pengendali di
          BEI.
        </p>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
            Memindai pelaporan insider…
          </div>
        ) : insiderAlerts.length === 0 ? (
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
            Tidak ada transaksi orang dalam bernilai signifikan pada pelaporan terkini.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {insiderAlerts.map((item, idx) => (
              <article
                key={`${item.ticker}-${idx}`}
                className="flex flex-col justify-between rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5 transition-colors hover:border-[var(--rasi-primary)]/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/saham/${item.ticker}`}
                      className="font-mono text-xl font-bold tracking-tight text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                    >
                      {item.ticker}
                    </Link>
                    <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rasi-text)]">
                      {item.action === 'BUY' ? 'Pembelian' : 'Penjualan'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPreview(item.ticker)}
                    className="mt-3 text-left text-sm font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                  >
                    {item.holderName}
                  </button>

                  <p className="mt-1 font-mono text-xs font-medium text-[var(--rasi-muted)]">
                    Estimasi nilai: Rp {(item.valueIdr / 1_000_000_000).toFixed(1)} M
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
                    {item.summary}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--rasi-border)] pt-3 text-xs text-[var(--rasi-muted)]">
                  <span>Sumber: Pelaporan Resmi BEI</span>
                  <div className="flex items-center gap-3">
                    <span>{item.timestamp?.split('T')[0] ?? 'Terkini'}</span>
                    <button
                      type="button"
                      onClick={() => openPreview(item.ticker)}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Pratinjau
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Stock Preview Dialog */}
      <StockPreviewDialog
        ticker={previewTicker}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}
