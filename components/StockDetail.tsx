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
import { ResearchWorkspace } from '@/components/ResearchWorkspace'
import { StockChart } from '@/components/StockChart'
import { useThemePreference } from '@/components/ThemePreferenceProvider'
import { Button, ButtonLink } from '@/components/ui'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'
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
  initialData?: StockDataResult
}

export default function StockDetail({ ticker, initialData }: StockDetailProps) {
  const symbol = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentTab = [
    'fundamental',
    'valuation',
    'ownership',
    'broker',
    'news',
    'insider',
    'research',
  ].includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as
        | 'fundamental'
        | 'valuation'
        | 'ownership'
        | 'broker'
        | 'news'
        | 'insider'
        | 'research')
    : 'fundamental'

  const { mode, setMode } = useThemePreference()

  // Data states
  const [data, setData] = useState<StockDataResult | null>(initialData ?? null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    initialData ? 'ready' : 'loading',
  )
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
    if (initialData) return
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadData()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadData, initialData])

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
      <div className="relative space-y-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-[var(--rasi-card-shadow)] sm:p-8">
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
            className="rasi-alert-danger rounded-lg p-2.5 text-xs"
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

        {/* Deep analysis explicit trigger with AI ambient highlight */}
        <div className="rasi-ambient-top-ai -mx-5 -mb-5 flex flex-col justify-between gap-3 border-t border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/40 p-5 text-xs sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:px-8">
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
            className="text-[var(--rasi-accent)] hover:text-[var(--rasi-accent)]"
          >
            Buat analisis baru
          </Button>
        </div>

        {analysisMessage && (
          <p
            className={`rounded-lg p-2.5 text-xs ${
              analysisState === 'done'
                ? 'rasi-alert-success'
                : 'rasi-alert-danger'
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
          <div className="relative flex-1 overflow-hidden">
            <div className="no-scrollbar flex overflow-x-auto scroll-smooth">
              {[
                { key: 'fundamental', label: 'Keuangan & Kinerja' },
                { key: 'valuation', label: 'Valuasi & Pembanding' },
                { key: 'ownership', label: 'Kepemilikan & Float' },
                { key: 'broker', label: 'Transaksi Broker' },
                { key: 'news', label: 'Berita & Katalis' },
                { key: 'research', label: 'Ruang Riset & Tesis' },
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
            {/* Visual gradient mask cue for horizontal scroll affordance on mobile */}
            <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-[var(--rasi-bg)] to-transparent sm:hidden" />
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
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-[var(--rasi-card-shadow)] sm:p-6">
          {/* TAB: FUNDAMENTAL */}
          {currentTab === 'fundamental' && (
            <div className="space-y-6">
              {mode === 'beginner' && (
                <div className="rasi-alert-info rounded-xl p-4 text-xs leading-relaxed">
                  <strong> Cara membaca keuangan: </strong> Evaluasi kinerja bisnis membandingkan
                  kuartal terkini dengan periode sama tahun sebelumnya (YoY). Perusahaan keuangan
                  (bank) dinilai dari pertumbuhan bunga dan kredit, sedangkan perusahaan nonkeuangan
                  dinilai dari pendapatan, laba, dan arus kas operasi.{' '}
                </div>
              )}

              {/* R07 Divergence Warning if present */}
              {data?.fundamentals &&
                'isCashFlowDivergent' in data.fundamentals &&
                data.fundamentals.isCashFlowDivergent && (
                  <div className="rasi-alert-warning rounded-xl p-4 text-xs">
                    <strong className="font-semibold">
                      ⚠️ Divergensi Arus Kas Operasi (R07):
                    </strong>{' '}
                    Perusahaan membukukan laba bersih positif, namun arus kas operasi negatif.
                    Periksa apakah laba tertahan di piutang atau persediaan sebelum mengambil
                    kesimpulan.
                  </div>
                )}

              {/* Bank Layout */}
              {data?.fundamentals?.group === 'BANK' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--rasi-text)]">
                      Kinerja Perbankan & Lembaga Keuangan ({data.fundamentals.quarter})
                    </h3>
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                      Basis: {data.fundamentals.basis}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pendapatan Bunga Bersih (NII) YoY
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {data.fundamentals.netInterestIncomeGrowth.growthLabel}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pertumbuhan Laba Bersih YoY
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {data.fundamentals.netIncomeGrowth.growthLabel}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Rasio Kredit terhadap Simpanan (LDR)
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {typeof data.fundamentals.loanToDepositRatio === 'number'
                          ? `${(data.fundamentals.loanToDepositRatio * 100).toFixed(1)}%`
                          : 'Data tidak tersedia'}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pertumbuhan Kredit (Loans) YoY
                      </span>
                      <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                        {data.fundamentals.loanGrowth?.growthLabel ?? 'Data tidak tersedia'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pertumbuhan DPK (Deposits) YoY
                      </span>
                      <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                        {data.fundamentals.depositGrowth?.growthLabel ?? 'Data tidak tersedia'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Non-Financial Layout */}
              {data?.fundamentals?.group === 'NON_FINANCIAL' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--rasi-text)]">
                      Kinerja Bisnis & Arus Kas ({data.fundamentals.quarter})
                    </h3>
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                      Basis: {data.fundamentals.basis}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pertumbuhan Pendapatan YoY
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {data.fundamentals.revenueGrowth.growthLabel}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Pertumbuhan Laba Bersih YoY
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {data.fundamentals.netIncomeGrowth.growthLabel}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Margin Laba Bersih (NPM)
                      </span>
                      <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                        {data.fundamentals.netMarginCurrent !== null
                          ? `${(data.fundamentals.netMarginCurrent * 100).toFixed(2)}%`
                          : 'Data tidak tersedia'}
                      </span>
                      {data.fundamentals.marginChangePoints !== null && (
                        <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                          Perubahan: {data.fundamentals.marginChangePoints >= 0 ? '+' : ''}
                          {data.fundamentals.marginChangePoints} pp vs tahun lalu
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Arus Kas Operasi (OCF)
                      </span>
                      <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                        {data.fundamentals.operatingCashFlow !== null
                          ? `Rp ${(data.fundamentals.operatingCashFlow / 1_000_000_000).toFixed(2)} M`
                          : 'Data tidak tersedia'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                      <span className="block text-xs text-[var(--rasi-muted)]">
                        Debt to Equity Ratio (DER)
                      </span>
                      <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                        {data.fundamentals.debtToEquity !== null
                          ? `${data.fundamentals.debtToEquity.toFixed(2)}x`
                          : 'Data tidak tersedia'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard P/E & P/B Overview */}
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
                    Harga dibanding aset setelah dikurangi utang
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    Hasil pemeriksaan keuangan
                  </span>
                  <span className="mt-2 block text-base font-bold">
                    {getStatusLabel(fundamental.status).label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {fundamental.reason || 'Perbandingan harga dan keuangan sudah diperiksa.'}
                  </span>
                </div>
              </div>

              {/* Business Exposure & Commodity Mapping (F11) */}
              {data?.businessExposure && (
                <div className="space-y-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rasi-border)] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--rasi-text)]">
                        Peta Bisnis & Eksposur Komoditas (F11)
                      </h4>
                      <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
                        {data.businessExposure.summary}
                      </p>
                    </div>
                    {data.businessExposure.concentrationLevel !== 'UNKNOWN' && (
                      <span
                        className={`rounded px-2.5 py-1 text-xs font-bold ${
                          data.businessExposure.concentrationLevel === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-300'
                            : data.businessExposure.concentrationLevel === 'MODERATE'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        Konsentrasi:{' '}
                        {data.businessExposure.concentrationLevel === 'HIGH'
                          ? 'Tinggi'
                          : data.businessExposure.concentrationLevel === 'MODERATE'
                            ? 'Moderat'
                            : 'Terdiversifikasi'}
                      </span>
                    )}
                  </div>

                  {/* Revenue Segments List */}
                  {data.businessExposure.segments.length > 0 && (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-[var(--rasi-muted)]">
                        Rincian Segmen Pendapatan
                      </span>
                      <div className="space-y-2">
                        {data.businessExposure.segments.map((seg, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-[var(--rasi-text)]">
                                {seg.name}
                              </span>
                              <span className="font-mono font-bold text-[var(--rasi-text)]">
                                {seg.percentage !== null ? `${seg.percentage}%` : '-'}
                              </span>
                            </div>
                            {seg.percentage !== null && (
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rasi-surface)]">
                                <div
                                  className="h-full bg-[var(--rasi-primary)]"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, seg.percentage))}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commodity Exposures */}
                  {data.businessExposure.commodityExposures.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="block text-xs font-semibold text-[var(--rasi-muted)]">
                        Keterhubungan Komoditas Terverifikasi
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.businessExposure.commodityExposures.map((exp, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[var(--rasi-text)]">
                                {exp.commodityName}
                              </span>
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                {exp.verificationStatus}
                              </span>
                            </div>
                            <p className="mt-1 text-[var(--rasi-muted)]">{exp.relationship}</p>
                            <span className="mt-1 block text-[10px] text-[var(--rasi-muted)]/70">
                              {exp.sourceNote}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: VALUATION & PEERS (F06) */}
          {currentTab === 'valuation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--rasi-text)]">
                  Valuasi Relatif & Pembanding Industri
                </h3>
                <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                  Bandingkan valuasi {symbol} terhadap median emiten sejenis dalam{' '}
                  <strong className="text-[var(--rasi-text)]">
                    {data?.peerComparison?.peerGroupName ?? 'Kelompok Industri'}
                  </strong>
                  .
                </p>
              </div>

              {/* R06 Value Trap Alert */}
              {data?.peerComparison?.ruleR06.triggered && (
                <div className="rasi-alert-warning rounded-xl p-4 text-xs">
                  <strong className="font-semibold">
                    ⚠️ Peringatan Valuasi Semu (R06):
                  </strong>{' '}
                  {data.peerComparison.ruleR06.explanation}
                </div>
              )}

              {/* Sample size warning */}
              {data?.peerComparison && !data.peerComparison.isSampleSufficient && (
                <div className="rasi-alert-info rounded-xl p-3 text-xs">
                  ℹ️ Jumlah pembanding aktif kurang dari 5 emiten; median mungkin kurang
                  representatif.
                </div>
              )}

              {/* Valuation Ranks Grid */}
              {data?.peerComparison && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                    <span className="block text-xs text-[var(--rasi-muted)]">P/E vs Median</span>
                    <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
                      {data.peerComparison.peRank.value !== null
                        ? `${data.peerComparison.peRank.value.toFixed(1)}x`
                        : 'N/A'}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                      Median: {data.peerComparison.peRank.median?.toFixed(1) ?? 'N/A'}x
                    </span>
                    <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
                      {data.peerComparison.peRank.summaryLabel}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                    <span className="block text-xs text-[var(--rasi-muted)]">P/B vs Median</span>
                    <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
                      {data.peerComparison.pbRank.value !== null
                        ? `${data.peerComparison.pbRank.value.toFixed(1)}x`
                        : 'N/A'}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                      Median: {data.peerComparison.pbRank.median?.toFixed(1) ?? 'N/A'}x
                    </span>
                    <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
                      {data.peerComparison.pbRank.summaryLabel}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                    <span className="block text-xs text-[var(--rasi-muted)]">ROE vs Median</span>
                    <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
                      {data.peerComparison.roeRank.value !== null
                        ? `${(data.peerComparison.roeRank.value * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                      Median:{' '}
                      {data.peerComparison.roeRank.median
                        ? `${(data.peerComparison.roeRank.median * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                    <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
                      {data.peerComparison.roeRank.summaryLabel}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                    <span className="block text-xs text-[var(--rasi-muted)]">
                      Dividend Yield vs Median
                    </span>
                    <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
                      {data.peerComparison.dividendYieldRank.value !== null
                        ? `${(data.peerComparison.dividendYieldRank.value * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                      Median:{' '}
                      {data.peerComparison.dividendYieldRank.median
                        ? `${(data.peerComparison.dividendYieldRank.median * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                    <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
                      {data.peerComparison.dividendYieldRank.summaryLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Peers Table */}
              {data?.peerComparison?.peers && data.peerComparison.peers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[var(--rasi-text)]">
                    Daftar Emiten Pembanding ({data.peerComparison.peers.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                        <tr>
                          <th className="p-3">Emiten</th>
                          <th className="p-3 text-right">P/E</th>
                          <th className="p-3 text-right">P/B</th>
                          <th className="p-3 text-right">ROE</th>
                          <th className="p-3 text-right">Div Yield</th>
                          <th className="p-3 text-right">Kapitalisasi Pasar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rasi-border)]">
                        {data.peerComparison.peers.map((peer) => (
                          <tr
                            key={peer.symbol}
                            className={`transition-colors hover:bg-[var(--rasi-muted-bg)] ${
                              peer.symbol === symbol ? 'bg-[var(--rasi-primary)]/10 font-bold' : ''
                            }`}
                          >
                            <td className="p-3">
                              <Link
                                href={`/saham/${peer.symbol}`}
                                className="font-mono text-[var(--rasi-primary)] hover:underline"
                              >
                                {peer.symbol}
                              </Link>
                              {peer.symbol === symbol && (
                                <span className="ml-2 rounded bg-[var(--rasi-primary)]/20 px-1.5 py-0.5 text-[10px] text-[var(--rasi-primary)]">
                                  Saham ini
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {peer.pe !== null ? `${peer.pe.toFixed(1)}x` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {peer.pb !== null ? `${peer.pb.toFixed(1)}x` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {peer.roe !== null ? `${(peer.roe * 100).toFixed(1)}%` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {peer.dividendYield !== null
                                ? `${(peer.dividendYield * 100).toFixed(1)}%`
                                : '-'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {peer.marketCap !== null
                                ? `Rp ${(peer.marketCap / 1_000_000_000_000).toFixed(1)} T`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: OWNERSHIP & FLOAT (F07) */}
          {currentTab === 'ownership' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--rasi-text)]">
                  Struktur Kepemilikan & Free Float
                </h3>
                <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                  Komposisi pemegang saham pengendali, saham publik (free float), dan pergeseran
                  antarbulan.
                </p>
              </div>

              {/* Free Float & Controlling Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">Free Float Publik</span>
                  <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
                    {data?.ownership?.freeFloat.percentage !== null &&
                    data?.ownership?.freeFloat.percentage !== undefined
                      ? `${data.ownership.freeFloat.percentage.toFixed(2)}%`
                      : 'Data tidak tersedia'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    {data?.ownership?.freeFloat.definition}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    Porsi Pemegang Pengendali
                  </span>
                  <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
                    {data?.ownership?.totalControllingPct !== null &&
                    data?.ownership?.totalControllingPct !== undefined
                      ? `${data.ownership.totalControllingPct.toFixed(2)}%`
                      : 'N/A'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                    Akumulasi kepemilikan pihak pengendali terdaftar
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
                  <span className="block text-xs text-[var(--rasi-muted)]">
                    Pergeseran Antarbulan
                  </span>
                  <span className="mt-2 block text-sm font-semibold">
                    {data?.ownership?.shift?.summary ??
                      'Data pergeseran bulanan belum mencukupi minimal 2 periode.'}
                  </span>
                </div>
              </div>

              {/* Top Shareholders Table */}
              {data?.ownership?.topShareholders && data.ownership.topShareholders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[var(--rasi-text)]">
                    Pemegang Saham Terbesar ({data.ownership.topShareholders.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                        <tr>
                          <th className="p-3">Nama Pemegang Saham</th>
                          <th className="p-3 text-right">Jumlah Saham</th>
                          <th className="p-3 text-right">Persentase</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rasi-border)]">
                        {data.ownership.topShareholders.map((sh, idx) => (
                          <tr key={idx} className="hover:bg-[var(--rasi-muted-bg)]">
                            <td className="p-3 font-medium">{sh.name}</td>
                            <td className="p-3 text-right font-mono">
                              {sh.shares ? sh.shares.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {sh.percentage ? `${sh.percentage.toFixed(2)}%` : '-'}
                            </td>
                            <td className="p-3 text-center">
                              {sh.isController ? (
                                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                                  Pengendali
                                </span>
                              ) : (
                                <span className="rounded bg-gray-500/20 px-2 py-0.5 text-[10px] text-[var(--rasi-muted)]">
                                  Publik / Lainnya
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

          {/* TAB: RESEARCH WORKSPACE (F12) */}
          {currentTab === 'research' && (
            <ResearchWorkspace
              ticker={symbol}
              companyName={data?.companyName || symbol}
              currentSnapshot={
                data
                  ? {
                      id: `snap-${data.ticker}-${data.priceDate || 'current'}`,
                      ticker: data.ticker,
                      companyName: data.companyName,
                      createdAt: new Date().toISOString(),
                      schemaVersion: '1.0.0',
                      ruleVersion: '1.0.0',
                      price: data.price,
                      priceChangeFraction: data.priceChangeFraction,
                      priceDate: data.priceDate,
                      envelopes: data.envelopes as unknown as AnalysisSnapshot['envelopes'],
                      indicators: data.indicators,
                      composite: data.composite,
                      provenance: { newsAnalysis: 'RULE_BASED' },
                    }
                  : null
              }
            />
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
