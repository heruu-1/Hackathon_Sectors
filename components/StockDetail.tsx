'use client'

import { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Bot,
  GitCompareArrows,
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
import {
  BrokerTab,
  FundamentalTab,
  InsiderTab,
  NewsTab,
  OwnershipTab,
  ValuationTab,
} from '@/components/stock-detail'
import { Button, ButtonLink } from '@/components/ui'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'
import type { DailyPriceRow } from '@/lib/contracts/market'
import {
  METRIC_EXPLANATIONS,
  formatCurrencyIdr,
  formatDateWib,
  formatPercentageChange,
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
        'fundamental' | 'valuation' | 'ownership' | 'broker' | 'news' | 'insider' | 'research')
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
      <div className="relative space-y-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-2xl shadow-black/40 sm:p-8">
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
              { key: 'fundamental', label: 'Keuangan & Kinerja' },
              { key: 'valuation', label: 'Valuasi & Pembanding' },
              { key: 'ownership', label: 'Kepemilikan & Float' },
              { key: 'broker', label: 'Transaksi Broker' },
              { key: 'news', label: 'Berita & Katalis' },
              { key: 'insider', label: 'Orang Dalam' },
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
            <FundamentalTab data={data} mode={mode} peVal={peVal} pbVal={pbVal} />
          )}

          {/* TAB: VALUATION & PEERS (F06) */}
          {currentTab === 'valuation' && <ValuationTab data={data} symbol={symbol} />}

          {/* TAB: OWNERSHIP & FLOAT (F07) */}
          {currentTab === 'ownership' && <OwnershipTab data={data} />}

          {/* TAB: BROKER */}
          {currentTab === 'broker' && <BrokerTab bandarmology={bandarmology} />}

          {/* TAB: NEWS */}
          {currentTab === 'news' && <NewsTab data={data} symbol={symbol} divergence={divergence} />}

          {/* TAB: INSIDER */}
          {currentTab === 'insider' && <InsiderTab insider={insider} />}

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
