'use client'

import { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Bot,
  ExternalLink,
  GitCompareArrows,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import {
  addToWatchlist,
  createAnalysisAction,
  deleteWatchlistItem,
  getStockData,
  getWatchlist,
} from '@/app/actions'
import { StockChart } from '@/components/StockChart'
import { useThemePreference } from '@/components/ThemePreferenceProvider'
import { Button, ButtonLink } from '@/components/ui'
import type { DailyPriceRow } from '@/lib/contracts/market'
import {
  METRIC_EXPLANATIONS,
  formatCurrencyIdr,
  formatDateWib,
  formatForeignFlow,
  formatPercentageChange,
  getNewsCategoryLabel,
  getNewsSentimentLabel,
  getStatusLabel,
} from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

export interface StockDetailProps {
  ticker: string
}

export default function StockDetail({ ticker }: StockDetailProps) {
  const symbol = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentTab = ['fundamental', 'broker', 'news', 'insider'].includes(
    searchParams.get('tab') ?? '',
  )
    ? (searchParams.get('tab') as 'fundamental' | 'broker' | 'news' | 'insider')
    : 'fundamental'

  const { mode, setMode } = useThemePreference()

  // Data states
  const [data, setData] = useState<StockDataResult | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')

  // Watchlist save states
  const [isSaved, setIsSaved] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle')
  const [saveError, setSaveError] = useState('')

  // Refresh and Deep analysis states
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing'>('idle')
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'done' | 'error'>(
    'idle',
  )
  const [analysisMessage, setAnalysisMessage] = useState('')

  // 1. Initial Load: Read-only cached stock data (NO Gemini, NO DB insert, NO quota cost)
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshState('refreshing')
      else setLoadState('loading')
      setLoadError('')

      try {
        const result = await getStockData(symbol, { forceRefresh: isRefresh })
        if (result.success && result.data) {
          setData(result.data)
          setLoadState('ready')
        } else {
          setLoadError(result.error || 'Data saham belum dapat dimuat.')
          setLoadState('error')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data pasar.'
        if (
          msg.includes('was not found on the server') ||
          msg.includes('Failed to find Server Action')
        ) {
          setLoadError('Aplikasi telah diperbarui. Muat ulang halaman untuk melanjutkan.')
        } else {
          setLoadError(msg)
        }
        setLoadState('error')
      } finally {
        if (isRefresh) setRefreshState('idle')
      }
    },
    [symbol],
  )

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadData()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadData])

  // 2. Check Watchlist status
  useEffect(() => {
    let isMounted = true
    void getWatchlist().then((res) => {
      if (!isMounted) return
      const found = res.data?.find((item) => item.ticker === symbol)
      if (found) {
        setIsSaved(true)
        setSavedId(found.id)
      } else {
        setIsSaved(false)
        setSavedId(null)
      }
    })
    return () => {
      isMounted = false
    }
  }, [symbol])

  // Watchlist save/remove toggle
  const toggleWatchlist = async () => {
    setSaveState('saving')
    setSaveError('')

    try {
      if (isSaved && savedId) {
        const res = await deleteWatchlistItem(savedId)
        if (res.success) {
          setIsSaved(false)
          setSavedId(null)
        } else {
          setSaveError(res.error || 'Gagal menghapus dari pantauan.')
        }
      } else {
        const res = await addToWatchlist({
          ticker: symbol,
          name: data?.companyName || symbol,
          lastPrice: data?.price || undefined,
          lastChange: data?.priceChangeFraction || undefined,
        })
        if (res.success && res.data) {
          setIsSaved(true)
          setSavedId(res.data.id)
        } else {
          setSaveError(res.error || 'Masuk dengan Google untuk menyimpan pantauan.')
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal mengubah status pantauan.')
    } finally {
      setSaveState('idle')
    }
  }

  // Deep Analysis with Gemini (Explicit User Action)
  const triggerDeepAnalysis = async () => {
    setAnalysisState('analyzing')
    setAnalysisMessage('')
    try {
      const res = await createAnalysisAction(symbol)
      if (res.success && res.data) {
        setAnalysisState('done')
        setAnalysisMessage('Analisis selesai dan tersimpan. Anda bisa membukanya lagi di Riwayat.')
        // Reload fresh data
        loadData(true)
      } else {
        setAnalysisState('error')
        setAnalysisMessage(
          res.error || 'Analisis belum berhasil dibuat. Pastikan Anda sudah masuk, lalu coba lagi.',
        )
      }
    } catch (err) {
      setAnalysisState('error')
      setAnalysisMessage(err instanceof Error ? err.message : 'Gagal menjalankan analisis AI.')
    }
  }

  const setTab = (tab: string) => {
    router.replace(`/saham/${symbol}?tab=${tab}`, { scroll: false })
  }

  if (loadState === 'loading') {
    return (
      <div className="py-16 text-center text-sm text-[var(--rasi-muted)]">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--rasi-primary)]" />
        <p className="font-semibold text-[var(--rasi-text)]">Memuat data pasar {symbol}…</p>
        <p className="mt-1 text-xs"> Memuat harga, laporan keuangan, dan transaksi saham. </p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200"
        >
          <h2 className="text-base font-bold">Gagal memuat data saham {symbol}</h2>
          <p className="mt-2 text-xs leading-relaxed">{loadError}</p>
          <div className="mt-5 flex gap-3">
            <Button variant="primary" size="sm" onClick={() => loadData()}>
              <RefreshCw className="h-4 w-4" /> Coba lagi
            </Button>
            <ButtonLink href="/saham" variant="secondary" size="sm">
              Kembali ke pencarian
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { text: changePctText, trend: changeTrend } = formatPercentageChange(
    data.priceChangeFraction,
  )
  const isUp = changeTrend === 'up'
  const isDown = changeTrend === 'down'

  const dailyRows: DailyPriceRow[] = data.envelopes?.daily?.data ?? []
  const fundamental = data.indicators.fundamental
  const bandarmology = data.indicators.bandarmology
  const divergence = data.indicators.divergence
  const insider = data.indicators.insider
  const composite = data.composite

  const valuationData = data.envelopes?.valuation?.data
  const peVal = valuationData?.historicalValuation?.[0]?.pe ?? fundamental.pe
  const pbVal = valuationData?.historicalValuation?.[0]?.pb ?? fundamental.pb

  return (
    <div className="space-y-8 py-4">
      {/* 1. Navigation & Company Identity */}
      <div>
        <Link
          href="/saham"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke pencarian
        </Link>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-3xl font-black tracking-tight text-[var(--rasi-text)] sm:text-4xl">
                {symbol}
              </h1>
              <span className="text-base font-medium text-[var(--rasi-muted)] sm:text-lg">
                {data.companyName}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
              Bursa Efek Indonesia (IDX) • Tanggal data: {formatDateWib(data.priceDate)}
            </p>
          </div>

          {/* Quick comparison action */}
          <div className="flex items-center gap-2">
            <ButtonLink
              href={`/bandingkan?symbols=${symbol}`}
              variant="secondary"
              size="sm"
              icon={GitCompareArrows}
            >
              Bandingkan
            </ButtonLink>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadData(true)}
              pending={refreshState === 'refreshing'}
              pendingText="Memperbarui…"
              icon={RefreshCw}
              title="Periksa pembaruan data"
            >
              Perbarui data
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Price, Change, Summary, and Primary Actions */}
      <div className="relative overflow-hidden space-y-5 rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 sm:p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-5 sm:flex-row sm:items-baseline">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-3xl font-extrabold text-[var(--rasi-text)] tabular-nums sm:text-4xl">
              {formatCurrencyIdr(data.price)}
            </span>
            <span
              className={`font-mono text-lg font-bold tabular-nums ${
                isUp
                  ? 'text-[var(--rasi-success)]'
                  : isDown
                    ? 'text-[var(--rasi-danger)]'
                    : 'text-[var(--rasi-muted)]'
              }`}
            >
              {changePctText}
            </span>
          </div>

          {/* Primary Action: Simpan ke pantauan & Secondary: Tanya AI */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isSaved ? 'secondary' : 'primary'}
              size="md"
              icon={isSaved ? BookmarkCheck : Bookmark}
              onClick={toggleWatchlist}
              pending={saveState === 'saving'}
              pendingText="Menyimpan…"
            >
              {isSaved ? 'Tersimpan di pantauan' : 'Simpan ke pantauan'}
            </Button>

            <ButtonLink href={`/asisten?symbol=${symbol}`} variant="secondary" size="md" icon={Bot}>
              Tanya AI
            </ButtonLink>
          </div>
        </div>

        {/* Local save error if any */}
        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200"
          >
            {saveError}
          </p>
        )}

        {/* 3. Brief Summary (always visible, not duplicated in tabs) */}
        <div>
          <h2 className="text-xs font-semibold tracking-wider text-[var(--rasi-muted)] uppercase">
            {' '}
            Ringkasan saham{' '}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--rasi-text)]">
            {composite?.reason || 'Belum ada hal khusus yang ditandai dari data yang tersedia.'}
          </p>
          <p className="mt-2 text-xs text-[var(--rasi-muted)]">
            {' '}
            Ringkasan memakai harga penutupan bursa dan laporan yang sudah terbit. Hasilnya bukan
            prediksi harga atau anjuran membeli saham.{' '}
          </p>
        </div>

        {/* Deep analysis explicit trigger */}
        <div className="flex flex-col justify-between gap-3 border-t border-[var(--rasi-border)] pt-4 text-xs sm:flex-row sm:items-center">
          <div>
            <span className="font-semibold text-[var(--rasi-text)]">
              {' '}
              Jelaskan berita dengan AI{' '}
            </span>
            <span className="text-[var(--rasi-muted)]">
              {' '}
              Minta Gemini menjelaskan berita saham ini dan simpan hasilnya. Masuk terlebih
              dahulu.{' '}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={Sparkles}
            onClick={triggerDeepAnalysis}
            pending={analysisState === 'analyzing'}
            pendingText="Menganalisis…"
          >
            Buat analisis baru
          </Button>
        </div>

        {analysisMessage && (
          <p
            className={`rounded-lg border p-2.5 text-xs ${
              analysisState === 'done'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-[#072418] dark:text-emerald-200'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200'
            }`}
          >
            {analysisMessage}
          </p>
        )}
      </div>

      {/* 4. Price and Volume Chart & Table (Actual DailyPriceRow series) */}
      <StockChart dailyRows={dailyRows} symbol={symbol} />

      {/* 5. Detail Tabs: Fundamental, Broker, Berita, Transaksi Orang Dalam */}
      <div className="space-y-4">
        {/* Tab Navigation and Mode Toggle */}
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--rasi-border)] sm:flex-row sm:items-center">
          <div className="flex overflow-x-auto">
            {[
              { key: 'fundamental', label: 'Keuangan perusahaan' },
              { key: 'broker', label: 'Transaksi broker' },
              { key: 'news', label: 'Berita' },
              { key: 'insider', label: 'Transaksi Orang Dalam' },
            ].map((tab) => {
              const active = currentTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTab(tab.key)}
                  className={`min-h-[44px] border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                      : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <span className="text-xs text-[var(--rasi-muted)]">Tampilan:</span>
            <button
              type="button"
              onClick={() => setMode(mode === 'beginner' ? 'detail' : 'beginner')}
              className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)] transition-colors hover:border-[var(--rasi-primary)]"
            >
              {mode === 'beginner' ? 'Dengan penjelasan' : 'Langsung ke data'}
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-2xl shadow-black/40 sm:p-6">
          {/* TAB: FUNDAMENTAL */}
          {currentTab === 'fundamental' && (
            <div className="space-y-6">
              {mode === 'beginner' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-950 dark:border-blue-900 dark:bg-[#071328] dark:text-blue-200">
                  <strong> Cara membaca angka ini: </strong> P/E membandingkan harga saham dengan
                  laba per saham. P/B membandingkannya dengan aset bersih per saham. Angka rendah
                  belum tentu murah; lihat juga kondisi perusahaan dan perusahaan sejenis.{' '}
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-[var(--rasi-text)]">
                  {' '}
                  Harga, laba, dan aset perusahaan{' '}
                </h3>
                <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                  {' '}
                  Perbandingan harga saham dengan angka dalam laporan keuangan perusahaan.{' '}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--rasi-muted)]">
                    <span> Harga dibanding laba (P/E) </span>
                    <details className="cursor-pointer">
                      <summary className="flex list-none items-center gap-0.5 text-[var(--rasi-primary)] hover:underline">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Apa artinya?</span>
                      </summary>
                      <p className="mt-2 rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-2 text-xs text-[var(--rasi-text)]">
                        {METRIC_EXPLANATIONS.peRatio.detailed}
                      </p>
                    </details>
                  </div>
                  <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
                    {peVal !== null && peVal !== undefined
                      ? `${peVal.toFixed(1)}x`
                      : 'Data belum cukup'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {peVal !== null && peVal !== undefined && peVal > 0 && peVal < 15
                      ? 'P/E di bawah 15; bandingkan juga dengan perusahaan sejenis'
                      : 'Lihat juga apakah laba perusahaan bertumbuh'}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--rasi-muted)]">
                    <span> Harga dibanding aset bersih (P/B) </span>
                    <details className="cursor-pointer">
                      <summary className="flex list-none items-center gap-0.5 text-[var(--rasi-primary)] hover:underline">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Apa artinya?</span>
                      </summary>
                      <p className="mt-2 rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-2 text-xs text-[var(--rasi-text)]">
                        {METRIC_EXPLANATIONS.pbRatio.detailed}
                      </p>
                    </details>
                  </div>
                  <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
                    {pbVal !== null && pbVal !== undefined
                      ? `${pbVal.toFixed(1)}x`
                      : 'Data belum cukup'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {' '}
                    Harga dibanding aset setelah dikurangi utang, menurut laporan keuangan{' '}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    {' '}
                    Hasil pemeriksaan keuangan{' '}
                  </span>
                  <span className="mt-2 block text-base font-bold">
                    {getStatusLabel(fundamental.status).label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {fundamental.reason || 'Perbandingan harga dan keuangan sudah diperiksa.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BROKER */}
          {currentTab === 'broker' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--rasi-text)]">
                  {' '}
                  Transaksi broker dan investor asing{' '}
                </h3>
                <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                  {' '}
                  Lihat porsi pembelian dan penjualan melalui broker terbesar pada hari bursa
                  terakhir.{' '}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    {' '}
                    Pola pembelian dan penjualan{' '}
                  </span>
                  <span className="mt-2 block text-xl font-bold">
                    {getStatusLabel(bandarmology.status).label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {bandarmology.flowSummary || 'Arus transaksi broker seimbang.'}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    {' '}
                    Porsi beli 3 broker terbesar{' '}
                  </span>
                  <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                    {bandarmology.cr3Buy !== null
                      ? `${bandarmology.cr3Buy.toFixed(1)}%`
                      : 'Data belum cukup'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    Porsi dari total pembelian oleh 3 broker teratas
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    Transaksi investor asing
                  </span>
                  <span className="mt-2 block text-xl font-bold">
                    {getStatusLabel(bandarmology.foreignFlowStatus).label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {formatForeignFlow(bandarmology.netForeignVal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: NEWS */}
          {currentTab === 'news' &&
            (() => {
              const allNews = data?.envelopes?.news?.data ?? []
              const latestArticle = allNews[0]
              const otherNews = allNews.slice(1)

              const featuredUrl =
                divergence.newsUrl ||
                (latestArticle?.source?.startsWith('http') ? latestArticle.source : null) ||
                (divergence.headline
                  ? `https://www.google.com/search?q=${encodeURIComponent(`${symbol} ${divergence.headline}`)}`
                  : null)

              let featuredSourceName = 'Berita Pasar'
              if (latestArticle?.source) {
                if (latestArticle.source.startsWith('http')) {
                  try {
                    featuredSourceName = new URL(latestArticle.source).hostname.replace(
                      /^www\./,
                      '',
                    )
                  } catch {
                    featuredSourceName = 'Sumber Berita'
                  }
                } else {
                  featuredSourceName = latestArticle.source
                }
              }

              return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[var(--rasi-text)]">
                      Berita dan perubahan harga
                    </h3>
                    <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                      Bandingkan berita perusahaan dengan perubahan harga sahamnya.
                    </p>
                  </div>

                  {/* Kartu Utama: Analisis Respons Pasar terhadap Berita Terkini */}
                  <div className="space-y-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rasi-border)] pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)]">
                          Perubahan harga: {getStatusLabel(divergence.status).label}
                        </span>
                        <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)]">
                          Isi berita: {getNewsSentimentLabel(divergence.sentiment)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--rasi-muted)]">
                        Kategori: {getNewsCategoryLabel(divergence.catalystType)}
                      </span>
                    </div>

                    {divergence.headline ? (
                      <div>
                        <a
                          href={featuredUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-start gap-1.5 text-base font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline"
                        >
                          <span>{divergence.headline}</span>
                          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[var(--rasi-muted)] group-hover:text-[var(--rasi-primary)]" />
                        </a>
                        {latestArticle?.body && (
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--rasi-muted)]">
                            {latestArticle.body}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--rasi-muted)]">
                        Belum ada berita penting dalam data yang tersedia.
                      </p>
                    )}

                    {divergence.verdict && (
                      <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3.5">
                        <span className="text-[11px] font-bold tracking-wider text-[var(--rasi-muted)] uppercase">
                          Hasil Analisis RASI
                        </span>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--rasi-text)]">
                          {divergence.verdict}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-[var(--rasi-border)] pt-2 text-[11px] text-[var(--rasi-muted)]">
                      <span>Sumber: {featuredSourceName}</span>
                      <span>{divergence.newsTimestamp?.split('T')[0] ?? 'Terkini'}</span>
                    </div>
                  </div>

                  {/* Berita Tambahan Lainnya (jika ada lebih dari 1 artikel) */}
                  {otherNews.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-[var(--rasi-text)]">
                        Berita Lainnya ({otherNews.length})
                      </h4>
                      <div className="divide-y divide-[var(--rasi-border)] rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
                        {otherNews.map((item, idx) => {
                          const isHttp =
                            item.source?.startsWith('http://') ||
                            item.source?.startsWith('https://')
                          const articleUrl = isHttp
                            ? item.source
                            : `https://www.google.com/search?q=${encodeURIComponent(`${symbol} ${item.title}`)}`
                          let sourceName = 'Berita Pasar'
                          if (isHttp) {
                            try {
                              sourceName = new URL(item.source).hostname.replace(/^www\./, '')
                            } catch {
                              sourceName = 'Sumber Berita'
                            }
                          } else if (item.source) {
                            sourceName = item.source
                          }

                          return (
                            <article
                              key={idx}
                              className="p-4 transition-colors hover:bg-[var(--rasi-muted-bg)]"
                            >
                              <a
                                href={articleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-start gap-1.5 text-sm font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline"
                              >
                                <span>{item.title}</span>
                                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rasi-muted)] group-hover:text-[var(--rasi-primary)]" />
                              </a>
                              {item.body && (
                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
                                  {item.body}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--rasi-muted)]">
                                <span className="font-medium text-[var(--rasi-text)]/80">
                                  {sourceName}
                                </span>
                                <span>•</span>
                                <span>{item.timestamp?.split('T')[0] ?? 'Terkini'}</span>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          {/* TAB: INSIDER */}
          {currentTab === 'insider' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--rasi-text)]">
                  {' '}
                  Jual beli pengurus dan pemegang saham besar{' '}
                </h3>
                <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                  {' '}
                  Laporan pembelian atau penjualan saham oleh direksi, komisaris, dan pemegang saham
                  pengendali.{' '}
                </p>
              </div>

              {insider.latestFiling ? (
                <div className="space-y-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--rasi-text)]">
                      {insider.latestFiling.holderName}
                    </span>
                    <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-bold">
                      {insider.latestFiling.action === 'BUY' ? 'Pembelian' : 'Penjualan'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-[var(--rasi-muted)]">
                    <div>
                      {' '}
                      Jumlah saham:{' '}
                      <strong className="font-mono text-[var(--rasi-text)]">
                        {insider.latestFiling.amountShares.toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div>
                      {' '}
                      Perkiraan nilai:{' '}
                      <strong className="font-mono text-[var(--rasi-text)]">
                        Rp {(insider.latestFiling.totalValueIdr / 1_000_000_000).toFixed(2)} M
                      </strong>
                    </div>
                    <div>
                      Tanggal:{' '}
                      <strong className="text-[var(--rasi-text)]">
                        {insider.latestFiling.date}
                      </strong>
                    </div>
                    <div>
                      {' '}
                      Perubahan kepemilikan:{' '}
                      <strong className="font-mono text-[var(--rasi-text)]">
                        {insider.latestFiling.pctChanged !== null
                          ? `${(insider.latestFiling.pctChanged * 100).toFixed(2)}%`
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  <p className="border-t border-[var(--rasi-border)] pt-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
                    {insider.summary}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-8 text-center text-xs text-[var(--rasi-muted)]">
                  Belum ada laporan jual beli saham dari pengurus perusahaan untuk saham ini.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Methods, Sources, and Explanations via Inline Disclosures */}
      <div className="space-y-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
        <h4 className="text-xs font-bold tracking-wider text-[var(--rasi-muted)] uppercase">
          {' '}
          Cara menghitung dan sumber data{' '}
        </h4>

        <details className="group text-xs text-[var(--rasi-muted)]">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)]">
            <span> Bagaimana skor RASI dihitung? </span>
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-2 space-y-1.5 border-l-2 border-[var(--rasi-border)] pl-2 text-xs leading-relaxed">
            <p>{METRIC_EXPLANATIONS.compositeScore.detailed}</p>
            <p>
              {' '}
              Jika ada data yang belum lengkap, skor tidak dihitung. Anda akan melihat tulisan{' '}
              <strong>Data belum cukup</strong>.
            </p>
          </div>
        </details>

        <details className="group border-t border-[var(--rasi-border)] pt-2 text-xs text-[var(--rasi-muted)]">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)]">
            <span>Dari mana sumber data ini diperoleh?</span>
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-2 space-y-1.5 border-l-2 border-[var(--rasi-border)] pl-2 text-xs leading-relaxed">
            <p>
              {' '}
              Harga harian, laporan keuangan, transaksi broker, berita, dan laporan kepemilikan
              diperoleh dari Sectors. Periksa tanggal pada setiap data karena waktu pembaruannya
              bisa berbeda.{' '}
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
