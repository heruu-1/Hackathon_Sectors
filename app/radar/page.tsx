'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ExternalLink,
  Eye,
  History,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import {
  type MarketRadarData,
  type RadarHistorySnapshot,
  getMarketRadarFeed,
  getRadarHistory,
} from '@/app/actions'
import { StockPreviewDialog } from '@/components/StockPreviewDialog'
import { Button } from '@/components/ui'
import { visibleRadarHistory } from '@/domain/radar'
import { getNewsSentimentLabel } from '@/lib/presentation/stock'

const HIDDEN_HISTORY_KEY = 'rasi_radar_hidden_through'
const EMPTY_GIANTS: MarketRadarData['sleepingGiants'] = []
const EMPTY_INSIDERS: MarketRadarData['insiderAlerts'] = []

function formatDate(isoString?: string): string {
  if (!isoString) return 'Terkini'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      timeZoneName: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export default function RadarPage() {
  const [data, setData] = useState<MarketRadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'radar' | 'history'>('radar')

  // History & snapshot state
  const [historyList, setHistoryList] = useState<RadarHistorySnapshot[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<RadarHistorySnapshot | null>(null)
  const requestId = useRef(0)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'sleeping' | 'insider'>('all')

  // Stock preview modal state
  const [previewTicker, setPreviewTicker] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const result = await getRadarHistory()
      if (!result.success) throw new Error(result.error || 'Gagal memuat riwayat radar.')
      let hiddenThrough: string | null = null
      try {
        hiddenThrough = localStorage.getItem(HIDDEN_HISTORY_KEY)
      } catch {
        /* Storage may be disabled. */
      }
      setHistoryList(visibleRadarHistory(result.data ?? [], hiddenThrough))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat radar.')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const loadFeed = useCallback(
    async (forceRefresh = false) => {
      const id = ++requestId.current
      setLoading(true)
      setError('')
      setSelectedSnapshot(null)
      try {
        const result = await getMarketRadarFeed({ forceRefresh })
        if (id !== requestId.current) return
        if (!result.success || !result.data)
          throw new Error(result.error || 'Data radar belum tersedia.')
        setData(result.data)
        setError(result.data.warning ?? '')
        void loadHistory()
      } catch (err) {
        if (id === requestId.current)
          setError(err instanceof Error ? err.message : 'Gagal memuat radar.')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [loadHistory],
  )

  useEffect(() => {
    const request = requestId
    const timer = window.setTimeout(() => {
      void loadFeed()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      request.current++
    }
  }, [loadFeed])

  const handleClearHistory = () => {
    if (
      !window.confirm(
        'Sembunyikan hasil sebelumnya di browser ini? Pengguna lain tetap dapat melihatnya.',
      )
    )
      return
    try {
      const latest = historyList
        .map((item) => item.scannedAt)
        .sort()
        .at(-1)
      if (latest) localStorage.setItem(HIDDEN_HISTORY_KEY, latest)
      setHistoryList([])
    } catch {
      setError('Pilihan Anda belum tersimpan. Izinkan penyimpanan di browser, lalu coba lagi.')
    }
  }

  // Handle viewing a historical snapshot
  const viewHistoricalSnapshot = (snapshot: RadarHistorySnapshot) => {
    requestId.current++
    setLoading(false)
    setSelectedSnapshot(snapshot)
    setData({
      pendingCatalysts: snapshot.pendingCatalysts,
      sleepingGiants: snapshot.sleepingGiants,
      insiderAlerts: snapshot.insiderAlerts,
      recentNewsCount: snapshot.recentNewsCount,
      recentFilingsCount: snapshot.recentFilingsCount,
      scannedAt: snapshot.scannedAt,
      isCached: true,
    })
    setActiveTab('radar')
  }

  // Return to active radar feed
  const returnToActiveRadar = () => {
    setSelectedSnapshot(null)
    loadFeed(false)
  }

  const openPreview = (ticker: string) => {
    setPreviewTicker(ticker)
    setPreviewOpen(true)
  }

  // Filtered items based on search query and filterType
  const allSleepingGiants = data?.sleepingGiants ?? EMPTY_GIANTS
  const allInsiderAlerts = data?.insiderAlerts ?? EMPTY_INSIDERS
  const allPendingCatalysts = data?.pendingCatalysts ?? EMPTY_GIANTS
  const pendingCatalysts = allPendingCatalysts.filter((item) => {
    const query = searchQuery.trim().toLowerCase()
    return `${item.ticker} ${item.headline} ${item.verdict}`.toLowerCase().includes(query)
  })

  const filteredSleepingGiants = useMemo(() => {
    if (filterType === 'insider') return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allSleepingGiants
    return allSleepingGiants.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.headline.toLowerCase().includes(q) ||
        item.verdict.toLowerCase().includes(q),
    )
  }, [allSleepingGiants, searchQuery, filterType])

  const filteredInsiderAlerts = useMemo(() => {
    if (filterType === 'sleeping') return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allInsiderAlerts
    return allInsiderAlerts.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.holderName.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q),
    )
  }, [allInsiderAlerts, searchQuery, filterType])

  const availableTickers = useMemo(() => {
    const set = new Set<string>()
    for (const g of allSleepingGiants) set.add(g.ticker)
    for (const p of allPendingCatalysts) set.add(p.ticker)
    for (const i of allInsiderAlerts) set.add(i.ticker)
    return Array.from(set)
  }, [allSleepingGiants, allPendingCatalysts, allInsiderAlerts])

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--rasi-primary)]">Radar Pasar</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {' '}
            Berita dan perubahan saham{' '}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--rasi-muted)]">
            {' '}
            Lihat berita perusahaan dan laporan jual beli pemegang saham besar. Radar membaca hingga
            30 berita dan 30 laporan, lalu membandingkan harga hingga 8 saham dengan berita
            positif.{' '}
          </p>
          {data?.scannedAt && (
            <p className="mt-1 text-xs text-[var(--rasi-muted)]">
              {' '}
              Terakhir diperiksa:{' '}
              <span className="font-medium text-[var(--rasi-text)]">
                {formatDate(data.scannedAt)}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadFeed(true)}
            pending={loading && !selectedSnapshot}
            pendingText="Memeriksa…"
            icon={RefreshCw}
          >
            Perbarui radar
          </Button>
        </div>
      </div>

      {/* Snapshot Viewing Notice Banner */}
      {selectedSnapshot && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold"> Anda sedang melihat hasil sebelumnya </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                {' '}
                Hasil pemeriksaan {formatDate(selectedSnapshot.scannedAt)} (
                {selectedSnapshot.sleepingGiantsCount} saham dengan berita positif dan harga belum
                banyak naik, {selectedSnapshot.insiderAlertsCount} laporan jual beli pemegang saham
                besar).{' '}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={returnToActiveRadar} icon={ArrowLeft}>
            Kembali ke radar terkini
          </Button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-[var(--rasi-border)]">
        <div className="flex flex-wrap gap-1 sm:gap-4">
          <button
            type="button"
            aria-pressed={activeTab === 'radar'}
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'radar'
                ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <Sparkles className="h-4 w-4" /> Hasil terbaru{' '}
            <span className="rounded-full bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs">
              {allSleepingGiants.length + allPendingCatalysts.length + allInsiderAlerts.length}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'history'}
            onClick={() => {
              setActiveTab('history')
              loadHistory()
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'history'
                ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <History className="h-4 w-4" />
            Riwayat Radar
            <span className="rounded-full bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs">
              {historyList.length}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* TAB 1: RADAR AKTIF */}
      {activeTab === 'radar' && (
        <div className="space-y-8">
          {/* Controls: Search & Filter */}
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-[var(--rasi-muted)]" />
                <input
                  aria-label="Cari kode saham, berita, atau nama pemegang saham"
                  type="text"
                  placeholder="Cari saham, berita, atau pemegang saham…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] py-2 pr-4 pl-9 text-sm text-[var(--rasi-text)] placeholder-[var(--rasi-muted)] focus:border-[var(--rasi-primary)] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  aria-pressed={filterType === 'all'}
                  onClick={() => setFilterType('all')}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterType === 'all'
                      ? 'bg-[var(--rasi-primary)] text-white'
                      : 'border border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  Semua (
                  {allSleepingGiants.length + allPendingCatalysts.length + allInsiderAlerts.length})
                </button>
                <button
                  type="button"
                  aria-pressed={filterType === 'sleeping'}
                  onClick={() => setFilterType('sleeping')}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterType === 'sleeping'
                      ? 'bg-[var(--rasi-primary)] text-white'
                      : 'border border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  {' '}
                  Berita ( {allSleepingGiants.length + allPendingCatalysts.length})
                </button>
                <button
                  type="button"
                  aria-pressed={filterType === 'insider'}
                  onClick={() => setFilterType('insider')}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterType === 'insider'
                      ? 'bg-[var(--rasi-primary)] text-white'
                      : 'border border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  {' '}
                  Pemegang saham besar ( {allInsiderAlerts.length})
                </button>
              </div>
            </div>

            {availableTickers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--rasi-muted)]">
                <span className="font-medium">Rekomendasi klik:</span>
                {availableTickers.slice(0, 8).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSearchQuery(t === searchQuery ? '' : t)}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                      searchQuery.toUpperCase() === t
                        ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-white'
                        : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-text)] hover:border-[var(--rasi-primary)] hover:text-[var(--rasi-primary)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="ml-1 text-[11px] text-[var(--rasi-muted)] underline hover:text-[var(--rasi-danger)]"
                  >
                    Hapus filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 1: Katalis Berita & Divergensi Harga */}
          {filterType !== 'insider' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[var(--rasi-primary)]" aria-hidden="true" />
                  <h2 className="text-lg font-bold tracking-tight">
                    {' '}
                    Berita positif dan perubahan harga{' '}
                  </h2>
                  <span className="rounded-full bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rasi-text)]">
                    {filteredSleepingGiants.length} saham dengan harga belum banyak naik{' '}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--rasi-muted)]">
                {' '}
                RASI mencari berita positif dan membandingkan harga sebelum dan setelah berita
                terbit. Hasil di bawah menunjukkan saham yang harganya belum banyak naik.{' '}
              </p>

              {pendingCatalysts.length > 0 && (
                <div className="space-y-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {pendingCatalysts.length} saham belum bisa dibandingkan harganya{' '}
                  </h3>
                  <p className="text-xs text-[var(--rasi-muted)]">
                    {' '}
                    Berita positif sudah ada, tetapi harga sebelum atau setelah berita terbit belum
                    lengkap. Kita belum bisa menilai perubahan harganya.{' '}
                  </p>
                  <ul className="divide-y divide-[var(--rasi-border)]">
                    {pendingCatalysts.map((item) => {
                      const newsUrl =
                        item.url ||
                        `https://www.google.com/search?q=${encodeURIComponent(`${item.ticker} ${item.headline}`)}`
                      return (
                        <li key={item.ticker} className="space-y-1 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={newsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--rasi-primary)] hover:underline"
                            >
                              <span>
                                {item.ticker} — {item.headline}
                              </span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                            </a>
                            <Link
                              href={`/saham/${item.ticker}?tab=news`}
                              className="shrink-0 text-xs text-[var(--rasi-muted)] hover:text-[var(--rasi-primary)] hover:underline"
                            >
                              Buka detail &rarr;
                            </Link>
                          </div>
                          <p className="text-xs text-[var(--rasi-muted)]">
                            Berita: {item.timestamp?.slice(0, 10) ?? 'Tanggal belum tersedia'} ·
                            Skor berita: + {item.impactScore} · Harga sebelum atau setelah berita
                            belum lengkap{' '}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {loading && !data ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />{' '}
                  Memeriksa berita terbaru…{' '}
                </div>
              ) : filteredSleepingGiants.length === 0 ? (
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
                  {searchQuery
                    ? 'Tidak ada saham yang cocok dengan pencarian Anda.'
                    : pendingCatalysts.length > 0
                      ? 'Perubahan harga saham di atas belum bisa dinilai karena datanya belum lengkap.'
                      : 'Dari berita yang diperiksa, belum ditemukan saham dengan berita positif dan harga yang belum banyak naik. Radar hanya memeriksa sebagian berita pasar.'}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredSleepingGiants.map((item, idx) => {
                    const newsUrl =
                      item.url ||
                      `https://www.google.com/search?q=${encodeURIComponent(`${item.ticker} ${item.headline}`)}`
                    return (
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
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Skor: +{item.impactScore}
                              </span>
                              <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rasi-text)]">
                                {getNewsSentimentLabel(item.sentiment)}
                              </span>
                            </div>
                          </div>

                          <a
                            href={newsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group mt-3 inline-flex items-start gap-1.5 text-left text-sm leading-snug font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                          >
                            <span>{item.headline}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rasi-muted)] group-hover:text-[var(--rasi-primary)]" />
                          </a>

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
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* Section 2: Transaksi Orang Dalam */}
          {filterType !== 'sleeping' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="h-5 w-5 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <h2 className="text-lg font-bold tracking-tight">
                    {' '}
                    Jual beli pemegang saham besar dan pengurus perusahaan{' '}
                  </h2>
                  <span className="rounded-full bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rasi-text)]">
                    {filteredInsiderAlerts.length} laporan{' '}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--rasi-muted)]">
                {' '}
                Laporan pembelian atau penjualan saham oleh direksi, komisaris, dan pemegang saham
                pengendali.{' '}
              </p>

              {loading && !data ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />{' '}
                  Memeriksa laporan jual beli saham…{' '}
                </div>
              ) : filteredInsiderAlerts.length === 0 ? (
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
                  {searchQuery
                    ? 'Tidak ada laporan jual beli yang cocok dengan pencarian Anda.'
                    : 'Belum ada laporan jual beli dari direksi, komisaris, atau pemegang saham besar dalam data yang diperiksa.'}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredInsiderAlerts.map((item, idx) => (
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
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                              item.action === 'BUY'
                                ? 'border border-emerald-300/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border border-rose-300/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            }`}
                          >
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
                        <span> Sumber: laporan kepemilikan melalui Sectors </span>
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
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT RADAR */}
      {activeTab === 'history' && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold tracking-tight"> Hasil pemeriksaan sebelumnya </h2>
              <p className="text-xs text-[var(--rasi-muted)]">
                {' '}
                Buka kembali hasil radar sebelumnya. Hingga 30 hasil terakhir tersedia untuk semua
                pengguna.{' '}
              </p>
            </div>
            {historyList.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearHistory}
                icon={Trash2}
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                Sembunyikan di browser ini
              </Button>
            )}
          </div>

          {loadingHistory ? (
            <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-sm text-[var(--rasi-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
              Memuat riwayat radar…
            </div>
          ) : historyList.length === 0 ? (
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-12 text-center">
              <History className="mx-auto h-8 w-8 text-[var(--rasi-muted)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--rasi-text)]">
                {' '}
                Belum ada hasil sebelumnya{' '}
              </p>
              <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                {' '}
                Hasil radar disimpan setelah pemeriksaan selesai. Jika baru diperbarui, radar akan
                menampilkan hasil terakhir.{' '}
              </p>
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('radar')
                    loadFeed(true)
                  }}
                  icon={RefreshCw}
                >
                  {' '}
                  Periksa sekarang{' '}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {historyList.map((snapshot) => {
                const isSelected = selectedSnapshot?.id === snapshot.id
                const tickers = [
                  ...new Set([
                    ...snapshot.sleepingGiants.map((s) => s.ticker),
                    ...snapshot.insiderAlerts.map((i) => i.ticker),
                  ]),
                ]

                return (
                  <div
                    key={snapshot.id}
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${
                      isSelected
                        ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)]/5'
                        : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] hover:border-[var(--rasi-border)]/80'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[var(--rasi-primary)]" />
                        <span className="text-sm font-semibold text-[var(--rasi-text)]">
                          {formatDate(snapshot.scannedAt)}
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-[var(--rasi-primary)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--rasi-primary)]">
                            {' '}
                            Sedang dibuka{' '}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--rasi-muted)]">
                        <span className="font-medium text-[var(--rasi-text)]">
                          {snapshot.sleepingGiantsCount} saham dengan berita positif dan harga belum
                          banyak naik{' '}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-[var(--rasi-text)]">
                          {snapshot.insiderAlertsCount} Transaksi pengurus dan pemegang saham
                          besar{' '}
                        </span>
                      </div>

                      {tickers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[11px] text-[var(--rasi-muted)]"> Saham: </span>
                          {tickers.slice(0, 10).map((t) => (
                            <span
                              key={t}
                              className="rounded border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--rasi-text)]"
                            >
                              {t}
                            </span>
                          ))}
                          {tickers.length > 10 && (
                            <span className="text-[10px] text-[var(--rasi-muted)]">
                              +{tickers.length - 10} lainnya
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => viewHistoricalSnapshot(snapshot)}
                        icon={Eye}
                      >
                        {isSelected ? 'Lihat lagi' : 'Lihat hasil'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Stock Preview Dialog */}
      <StockPreviewDialog
        ticker={previewTicker}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}
