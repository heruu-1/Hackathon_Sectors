'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  Check,
  Coins,
  Cpu,
  Edit3,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Loader2,
  Newspaper,
  Plus,
  Radar,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserCheck,
  X,
  Zap,
} from 'lucide-react'

import type { Anomaly, WatchlistItem } from '@/db/schema'
import type { BandarmologyAnalysis, TopBrokerItem } from '@/lib/bandarmology'
import type { CatalystDivergence } from '@/lib/divergence'
import type { InsiderMovementAnalysis } from '@/lib/insider'
import { cn } from '@/lib/utils'

import {
  type MarketRadarData,
  addToWatchlist,
  analyzeTicker,
  deleteWatchlistItem,
  getMarketRadarFeed,
  getRecentAnomalies,
  getWatchlist,
  updateWatchlistItem,
} from './actions'

type TabType = 'terminal' | 'radar' | 'watchlist' | 'history'

const PRESET_TICKERS = ['BBCA', 'BREN', 'MAYA', 'TLKM', 'ASII', 'GOTO', 'ADRO']

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('terminal')
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [radarData, setRadarData] = useState<MarketRadarData | null>(null)
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isLoadingRadar, setIsLoadingRadar] = useState(true)
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Modals & Interactive Overlays
  const [selectedBroker, setSelectedBroker] = useState<TopBrokerItem | null>(null)
  const [editingWatchlist, setEditingWatchlist] = useState<Partial<WatchlistItem> | null>(null)
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Load history from PostgreSQL
  const loadHistory = useCallback(() => {
    return getRecentAnomalies()
      .then((res) => {
        if (res.error) {
          setErrorMsg(res.error)
        } else if (res.data) {
          setAnomalies(res.data)
          setSelectedAnomaly((selected) =>
            selected
              ? (res.data.find((row) => row.id === selected.id) ?? res.data[0] ?? null)
              : (res.data[0] ?? null),
          )
        }
      })
      .catch(() => setErrorMsg('Riwayat gagal dimuat. Pastikan database aktif, lalu klik Refresh.'))
      .finally(() => setIsLoadingHistory(false))
  }, [])

  // Load Market Radar feed
  const loadRadar = useCallback(() => {
    return getMarketRadarFeed()
      .then((res) => {
        if (res.data) {
          setRadarData(res.data)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingRadar(false))
  }, [])

  // Load Watchlist from PostgreSQL
  const loadWatchlistData = useCallback(() => {
    return getWatchlist()
      .then((res) => {
        if (res.data) {
          setWatchlistItems(res.data)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingWatchlist(false))
  }, [])

  useEffect(() => {
    void loadHistory()
    void loadRadar()
    void loadWatchlistData()
  }, [loadHistory, loadRadar, loadWatchlistData])

  const handleAnalyze = async (tickerToAnalyze: string) => {
    const symbol = tickerToAnalyze.trim().toUpperCase()
    if (!symbol || isAnalyzing) return

    setIsAnalyzing(true)
    setErrorMsg('')

    try {
      const result = await analyzeTicker(symbol)
      if (result.error) {
        setErrorMsg(result.error)
      } else if (result.data) {
        setAnomalies((prev) => [result.data, ...prev.filter((a) => a.id !== result.data.id)].slice(0, 25))
        setSelectedAnomaly(result.data)
        setSearchInput('')
        setActiveTab('terminal')
        showToast(`Analisis ${symbol} selesai!`)
      }
    } catch {
      setErrorMsg('Analisis gagal dijalankan. Silakan coba lagi.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Watchlist Actions (CRUD)
  const handleSaveWatchlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWatchlist?.ticker?.trim()) return

    try {
      if (editingWatchlist.id) {
        // Update
        const res = await updateWatchlistItem(editingWatchlist.id, {
          targetPrice: editingWatchlist.targetPrice || undefined,
          notes: editingWatchlist.notes || undefined,
          priority: editingWatchlist.priority || undefined,
          status: editingWatchlist.status || undefined,
        })
        if (res.success && res.data) {
          setWatchlistItems((prev) =>
            prev.map((item) => (item.id === res.data?.id ? res.data : item)),
          )
          showToast(`Watchlist ${res.data.ticker} diperbarui!`)
        }
      } else {
        // Create
        const res = await addToWatchlist({
          ticker: editingWatchlist.ticker,
          name: editingWatchlist.name || editingWatchlist.ticker,
          targetPrice: editingWatchlist.targetPrice || undefined,
          notes: editingWatchlist.notes || undefined,
          priority: editingWatchlist.priority || 'MEDIUM',
          status: editingWatchlist.status || 'WATCHING',
          lastPrice: editingWatchlist.lastPrice || undefined,
          lastChange: editingWatchlist.lastChange || undefined,
        })
        if (res.success && res.data) {
          setWatchlistItems((prev) => [
            res.data!,
            ...prev.filter((item) => item.id !== res.data?.id),
          ])
          showToast(`Saham ${res.data.ticker} berhasil masuk Watchlist!`)
        }
      }
      setIsWatchlistModalOpen(false)
      setEditingWatchlist(null)
    } catch {
      setErrorMsg('Gagal menyimpan ke watchlist.')
    }
  }

  const handleDeleteWatchlist = async (id: number, ticker: string) => {
    try {
      const res = await deleteWatchlistItem(id)
      if (res.success) {
        setWatchlistItems((prev) => prev.filter((item) => item.id !== id))
        showToast(`Saham ${ticker} dihapus dari Watchlist.`)
      }
    } catch {
      setErrorMsg('Gagal menghapus dari watchlist.')
    }
  }

  const handleQuickAddWatchlist = async (ticker: string, name?: string, note?: string) => {
    try {
      const res = await addToWatchlist({
        ticker,
        name: name || ticker,
        notes: note || 'Ditambahkan via Market Radar',
        priority: 'HIGH',
        status: 'SLEEPING_GIANT',
      })
      if (res.success && res.data) {
        setWatchlistItems((prev) => [
          res.data!,
          ...prev.filter((item) => item.id !== res.data?.id),
        ])
        showToast(`⭐️ ${ticker} ditambahkan ke Watchlist!`)
      }
    } catch {
      setErrorMsg('Gagal menambahkan ke watchlist.')
    }
  }

  // Parse JSON intelligence fields from selected anomaly
  const bandar = (selectedAnomaly?.bandarmology as BandarmologyAnalysis | null) ?? null
  const catalyst = (selectedAnomaly?.catalystDivergence as CatalystDivergence | null) ?? null
  const insider = (selectedAnomaly?.insiderMovement as InsiderMovementAnalysis | null) ?? null
  const composite = selectedAnomaly?.compositeScore ?? selectedAnomaly?.risk ?? 50
  const isSelectedInWatchlist = watchlistItems.some((w) => w.ticker === selectedAnomaly?.ticker)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#04060A] font-sans text-slate-200 selection:bg-rose-500/30 selection:text-white">
      {/* Background Ambience Glows */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 opacity-25">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 mix-blend-screen blur-[140px]" />
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-4 py-2 text-xs font-semibold text-emerald-300 shadow-2xl backdrop-blur-md"
        >
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </motion.div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-600 shadow-[0_0_25px_rgba(244,63,94,0.45)]">
              <Radar className="h-6 w-6 animate-pulse text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                  RASI
                </h1>
                <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  Terminal v2.0
                </span>
              </div>
              <p className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">
                Report Analisis Saham Indonesia • Radar Bandarmology & Katalis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Quota Protection Status */}
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>Quota Shield: Active</span>
            </div>

            {/* Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleAnalyze(searchInput)
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                placeholder="Kode Saham (e.g. BBCA)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Kode saham IDX"
                disabled={isAnalyzing}
                className="h-10 w-48 sm:w-64 rounded-xl border border-white/15 bg-white/[0.06] pr-24 pl-4 text-sm font-medium text-white transition-all placeholder:text-slate-500 focus:border-rose-500/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-rose-500/20 focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !searchInput.trim()}
                className="absolute right-1.5 flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Analyze
              </button>
            </form>
          </div>
        </div>

        {/* Preset Tickers Bar & Main Tabs */}
        <div className="border-t border-white/5 bg-black/40 px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-400 w-full sm:w-auto">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase shrink-0">
                <Flame className="h-3.5 w-3.5 text-amber-500" /> Hot Radar:
              </span>
              {PRESET_TICKERS.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => void handleAnalyze(symbol)}
                  disabled={isAnalyzing}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-mono font-semibold text-slate-300 transition-all hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-white"
                >
                  {symbol}
                </button>
              ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('terminal')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === 'terminal'
                    ? 'bg-gradient-to-r from-rose-500/30 to-orange-500/30 text-white border border-rose-500/40 shadow-lg'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent',
                )}
              >
                <Cpu className="h-3.5 w-3.5 text-rose-400" />
                Terminal
              </button>
              <button
                onClick={() => setActiveTab('radar')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === 'radar'
                    ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-white border border-amber-500/40 shadow-lg'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent',
                )}
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Market Radar
                {radarData?.sleepingGiants && radarData.sleepingGiants.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                    {radarData.sleepingGiants.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('watchlist')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === 'watchlist'
                    ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-white border border-emerald-500/40 shadow-lg'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent',
                )}
              >
                <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                Watchlist ({watchlistItems.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-white border border-indigo-500/40 shadow-lg'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent',
                )}
              >
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                Riwayat ({anomalies.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg('')}
              className="text-xs text-rose-400/80 hover:text-rose-200 ml-4 font-semibold"
            >
              Tutup
            </button>
          </div>
        )}

        {/* TAB 1: DEEP-DIVE TERMINAL */}
        {activeTab === 'terminal' && (
          <div className="space-y-8">
            {!selectedAnomaly ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#0A0D14]/80 p-12 text-center backdrop-blur-md">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-rose-400 shadow-inner">
                  <Radar className="h-8 w-8 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-white">Pilih atau Cari Saham</h3>
                <p className="mt-1 max-w-md text-sm text-slate-400">
                  Ketik kode saham IDX (contoh: <span className="font-mono text-rose-400">BBCA</span>,{' '}
                  <span className="font-mono text-rose-400">BREN</span>, atau{' '}
                  <span className="font-mono text-rose-400">MAYA</span>) untuk memulai radar
                  Bandarmology, Katalis Berita AI, dan Transaksi Insider.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {PRESET_TICKERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleAnalyze(s)}
                      disabled={isAnalyzing}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-white"
                    >
                      Analisis {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {/* Hero Header Card */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A0D14]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                  {/* Decorative Glow */}
                  <div
                    className={cn(
                      'pointer-events-none absolute top-0 right-0 h-80 w-80 rounded-full blur-[120px] opacity-25',
                      composite > 75
                        ? 'bg-rose-500'
                        : composite > 50
                          ? 'bg-orange-500'
                          : composite > 30
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500',
                    )}
                  />

                  <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
                          {selectedAnomaly.ticker}
                        </h2>
                        <span
                          className={cn(
                            'rounded-full px-3 py-0.5 text-xs font-extrabold tracking-wider uppercase',
                            selectedAnomaly.status === 'CRITICAL'
                              ? 'border border-rose-500/40 bg-rose-500/20 text-rose-400'
                              : selectedAnomaly.status === 'HIGH'
                                ? 'border border-orange-500/40 bg-orange-500/20 text-orange-400'
                                : selectedAnomaly.status === 'WARNING'
                                  ? 'border border-yellow-500/40 bg-yellow-500/20 text-yellow-400'
                                  : 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-400',
                          )}
                        >
                          {selectedAnomaly.status}
                        </span>

                        {/* Special Status Badges */}
                        {catalyst?.status === 'SLEEPING_GIANT' && (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300">
                            <Sparkles className="h-3.5 w-3.5" /> SLEEPING GIANT
                          </span>
                        )}
                        {bandar?.status === 'BIG_ACCUMULATION' && (
                          <span className="flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/20 px-3 py-0.5 text-xs font-bold text-purple-300">
                            <Coins className="h-3.5 w-3.5" /> BIG ACCUMULATION
                          </span>
                        )}
                        {insider?.status === 'STEEP_DISCOUNT_DUMP' && (
                          <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/30 px-3 py-0.5 text-xs font-bold text-rose-300 animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5" /> INSIDER DUMP
                          </span>
                        )}

                        {/* Watchlist Toggle Button */}
                        <button
                          onClick={() => {
                            setEditingWatchlist({
                              ticker: selectedAnomaly.ticker,
                              name: selectedAnomaly.name,
                              lastPrice: selectedAnomaly.price,
                              lastChange: selectedAnomaly.change,
                              targetPrice: '',
                              notes: `Analisis status: ${selectedAnomaly.status}. Bandar: ${bandar?.status || 'N/A'}.`,
                              priority: 'HIGH',
                              status: catalyst?.status === 'SLEEPING_GIANT' ? 'SLEEPING_GIANT' : 'WATCHING',
                            })
                            setIsWatchlistModalOpen(true)
                          }}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold transition-all shadow-sm',
                            isSelectedInWatchlist
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20 hover:text-white',
                          )}
                        >
                          {isSelectedInWatchlist ? (
                            <>
                              <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400" />
                              Di Watchlist
                            </>
                          ) : (
                            <>
                              <Star className="h-3.5 w-3.5 text-amber-400" />
                              + Watchlist
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-base text-slate-300 font-medium">
                        {selectedAnomaly.name}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 text-rose-400" />
                          Harga:{' '}
                          <span className="font-mono font-bold text-white text-sm">
                            {selectedAnomaly.price}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-0.5 font-semibold text-sm',
                            selectedAnomaly.change.startsWith('+')
                              ? 'text-emerald-400'
                              : selectedAnomaly.change.startsWith('-')
                                ? 'text-rose-400'
                                : 'text-slate-400',
                          )}
                        >
                          {selectedAnomaly.change.startsWith('+') ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : selectedAnomaly.change.startsWith('-') ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : null}
                          {selectedAnomaly.change}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart2 className="h-3.5 w-3.5 text-amber-400" />
                          Volume Spike:{' '}
                          <span className="font-mono font-bold text-white">
                            {selectedAnomaly.volumeSpike}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Composite Threat/Opportunity Score Meter */}
                    <div className="flex items-center gap-6 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="relative flex h-24 w-24 items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="6"
                            className="text-white/10"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="6"
                            className={cn(
                              composite > 75
                                ? 'text-rose-500'
                                : composite > 50
                                  ? 'text-orange-500'
                                  : composite > 30
                                    ? 'text-yellow-500'
                                    : 'text-emerald-500',
                            )}
                            strokeDasharray="251"
                            strokeDashoffset={251 - (251 * composite) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="text-center">
                          <div className="text-2xl font-black text-white">{composite}</div>
                          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            RASI Score
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="text-slate-400">
                          Fundamental Risk:{' '}
                          <span className="font-bold text-white">
                            {selectedAnomaly.risk}/100
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Bandar Health:{' '}
                          <span className="font-bold text-white">
                            {bandar?.bandarScore ?? 50}/100
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Divergence Alert:{' '}
                          <span className="font-bold text-white">
                            {catalyst?.divergenceScore ?? 30}/100
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Insider Risk:{' '}
                          <span className="font-bold text-white">
                            {insider?.insiderRiskScore ?? 20}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Verdict Callout */}
                  <div className="relative z-10 mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-300">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
                      <Info className="h-4 w-4 text-rose-400" />
                      Executive Summary & Anomaly Verdict:
                    </div>
                    {selectedAnomaly.reason}
                  </div>
                </div>

                {/* 4 Pillars Grid */}
                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Pillar 1: Bandarmology & Big Money Flow */}
                  <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0A0D14]/90 p-6 backdrop-blur-xl">
                    <div>
                      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-purple-400" />
                          <h3 className="font-bold text-white text-lg">
                            Bandarmology & Flow
                          </h3>
                        </div>
                        <span
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide',
                            bandar?.status === 'BIG_ACCUMULATION'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : bandar?.status === 'NORMAL_ACCUMULATION'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : bandar?.status === 'BIG_DISTRIBUTION'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-white/10 text-slate-300 border border-white/10',
                          )}
                        >
                          {bandar?.status?.replace(/_/g, ' ') ?? 'NEUTRAL'}
                        </span>
                      </div>

                      {/* Key Bandar Metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                          <div className="text-[11px] text-slate-400">CR3 Pembeli</div>
                          <div className="mt-1 text-xl font-bold text-white font-mono">
                            {bandar?.cr3Buy ?? 0}%
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                          <div className="text-[11px] text-slate-400">CR3 Penjual</div>
                          <div className="mt-1 text-xl font-bold text-white font-mono">
                            {bandar?.cr3Sell ?? 0}%
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                          <div className="text-[11px] text-slate-400">Net Foreign</div>
                          <div
                            className={cn(
                              'mt-1 text-sm font-bold font-mono',
                              (bandar?.netForeignVal ?? 0) > 0
                                ? 'text-emerald-400'
                                : (bandar?.netForeignVal ?? 0) < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-300',
                            )}
                          >
                            Rp {(((bandar?.netForeignVal ?? 0) / 1_000_000_000)).toFixed(1)}M
                          </div>
                        </div>
                      </div>

                      {/* Bandar Avg Cost */}
                      {bandar?.bandarAvgPrice && (
                        <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2.5 text-xs">
                          <span className="text-slate-300">
                            Estimasi Modal Rata-Rata Bandar:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-300 text-sm">
                              Rp {bandar.bandarAvgPrice.toLocaleString('id-ID')}
                            </span>
                            {bandar.bandarMarginPct !== null && (
                              <span
                                className={cn(
                                  'font-mono font-semibold text-[11px]',
                                  bandar.bandarMarginPct >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400',
                                )}
                              >
                                ({bandar.bandarMarginPct >= 0 ? '+' : ''}
                                {bandar.bandarMarginPct}%)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Top Buyers vs Top Sellers Table */}
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        {/* Top Buyers */}
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <div className="mb-2 font-bold text-emerald-400 flex items-center gap-1">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Top 3 Pembeli
                          </div>
                          <div className="space-y-2">
                            {bandar?.topBuyers.slice(0, 3).map((b) => (
                              <div
                                key={b.code}
                                onClick={() => setSelectedBroker(b)}
                                className="flex items-center justify-between p-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 font-mono font-bold text-[10px]',
                                      b.isForeign
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : b.cohort === 'retail'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
                                    )}
                                  >
                                    {b.code}
                                  </span>
                                  <span className="truncate w-16 text-slate-400 text-[10px]">
                                    {b.name}
                                  </span>
                                </div>
                                <span className="font-mono text-slate-300 font-medium text-[11px]">
                                  Rp {(b.value / 1_000_000_000).toFixed(1)}M
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Sellers */}
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <div className="mb-2 font-bold text-rose-400 flex items-center gap-1">
                            <ArrowDownRight className="h-3.5 w-3.5" /> Top 3 Penjual
                          </div>
                          <div className="space-y-2">
                            {bandar?.topSellers.slice(0, 3).map((b) => (
                              <div
                                key={b.code}
                                onClick={() => setSelectedBroker(b)}
                                className="flex items-center justify-between p-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 font-mono font-bold text-[10px]',
                                      b.isForeign
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : b.cohort === 'retail'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
                                    )}
                                  >
                                    {b.code}
                                  </span>
                                  <span className="truncate w-16 text-slate-400 text-[10px]">
                                    {b.name}
                                  </span>
                                </div>
                                <span className="font-mono text-slate-300 font-medium text-[11px]">
                                  Rp {(b.value / 1_000_000_000).toFixed(1)}M
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sumber: Sectors v2 Broker Summary</span>
                      <span>Tanggal: {bandar?.date ?? 'EOD'}</span>
                    </div>
                  </div>

                  {/* Pillar 2: News Catalyst & Divergence ("Sleeping Giant") */}
                  <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0A0D14]/90 p-6 backdrop-blur-xl">
                    <div>
                      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                          <Newspaper className="h-5 w-5 text-amber-400" />
                          <h3 className="font-bold text-white text-lg">
                            Katalis Berita & AI Divergence
                          </h3>
                        </div>
                        <span className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                          <Cpu className="h-3.5 w-3.5" />
                          Gemini 3 Flash Analysis
                        </span>
                      </div>

                      {/* Divergence Card */}
                      <div
                        className={cn(
                          'rounded-2xl border p-4 transition-all',
                          catalyst?.status === 'SLEEPING_GIANT'
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                            : catalyst?.status === 'DELAYED_SELL_OFF_RISK'
                              ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                              : 'border-white/5 bg-white/[0.02]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider',
                                catalyst?.sentiment === 'BULLISH'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : catalyst?.sentiment === 'BEARISH'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-white/10 text-slate-300',
                              )}
                            >
                              Sentimen: {catalyst?.sentiment ?? 'NEUTRAL'}
                            </span>
                            <h4 className="mt-2 text-sm font-bold text-white leading-snug">
                              {catalyst?.headline ?? 'Belum ada berita signifikan'}
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase">Impact Score</div>
                            <div
                              className={cn(
                                'text-xl font-black font-mono',
                                (catalyst?.impactScore ?? 0) > 0
                                  ? 'text-emerald-400'
                                  : (catalyst?.impactScore ?? 0) < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-300',
                              )}
                            >
                              {(catalyst?.impactScore ?? 0) > 0 ? '+' : ''}
                              {catalyst?.impactScore ?? 0}
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                          {catalyst?.verdict}
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-slate-400">
                          <span>Kategori: {catalyst?.catalystType ?? 'GENERAL'}</span>
                          <span className="font-semibold text-slate-200">
                            {catalyst?.recommendation}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sumber: Sectors v2 News Feed</span>
                      <span>Update: {catalyst?.newsTimestamp?.split('T')[0] ?? 'Terkini'}</span>
                    </div>
                  </div>

                  {/* Pillar 3: Insider Filings Tracker */}
                  <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0A0D14]/90 p-6 backdrop-blur-xl">
                    <div>
                      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-5 w-5 text-rose-400" />
                          <h3 className="font-bold text-white text-lg">
                            Transaksi Insider & Pemegang Saham
                          </h3>
                        </div>
                        <span
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider',
                            insider?.status === 'STEEP_DISCOUNT_DUMP'
                              ? 'border border-rose-500/50 bg-rose-500/20 text-rose-300'
                              : insider?.status === 'AGGRESSIVE_BUY'
                                ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                : 'border border-white/10 bg-white/5 text-slate-300',
                          )}
                        >
                          {insider?.status?.replace(/_/g, ' ') ?? 'ROUTINE'}
                        </span>
                      </div>

                      {insider?.latestFiling ? (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">
                              {insider.latestFiling.holderName}
                            </span>
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 font-bold',
                                insider.latestFiling.action === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300',
                              )}
                            >
                              {insider.latestFiling.action}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1">
                            <div>
                              Volume Lembar:{' '}
                              <span className="font-mono text-white font-semibold">
                                {insider.latestFiling.amountShares.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div>
                              Harga Eksekusi:{' '}
                              <span className="font-mono text-white font-semibold">
                                {insider.latestFiling.transactionPrice !== null
                                  ? `Rp ${insider.latestFiling.transactionPrice.toLocaleString('id-ID')}`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div>
                              Estimasi Nilai:{' '}
                              <span className="font-mono text-white font-semibold">
                                Rp {(insider.latestFiling.totalValueIdr / 1_000_000_000).toFixed(2)}M
                              </span>
                            </div>
                            <div>
                              Porsi Saham:{' '}
                              <span className="font-mono text-white font-semibold">
                                {(insider.latestFiling.pctChanged * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          <p className="mt-2 text-slate-300 text-[11px] leading-relaxed border-t border-white/5 pt-2">
                            {insider.summary}
                          </p>

                          {insider.latestFiling.sourceUrl && (
                            <div className="pt-1 text-right">
                              <a
                                href={insider.latestFiling.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-rose-400 hover:underline"
                              >
                                Dokumen KSEI / BEI <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          Tidak ditemukan aktivitas transaksi insider terbaru untuk emiten ini.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sumber: Sectors v2 Filings</span>
                      <span>Tanggal: {insider?.latestFiling?.date ?? 'Terkini'}</span>
                    </div>
                  </div>

                  {/* Pillar 4: Fundamental Health & Ratio Check */}
                  <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0A0D14]/90 p-6 backdrop-blur-xl">
                    <div>
                      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-emerald-400" />
                          <h3 className="font-bold text-white text-lg">
                            Pondasi Fundamental & Valuasi
                          </h3>
                        </div>
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
                          Sectors Report v2
                        </span>
                      </div>

                      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Risk Assessment:</span>
                          <span
                            className={cn(
                              'font-bold',
                              selectedAnomaly.risk > 70
                                ? 'text-rose-400'
                                : selectedAnomaly.risk > 40
                                  ? 'text-yellow-400'
                                  : 'text-emerald-400',
                            )}
                          >
                            {selectedAnomaly.risk}/100 ({selectedAnomaly.status})
                          </span>
                        </div>

                        <div className="text-slate-300 text-xs leading-relaxed border-t border-white/5 pt-2">
                          {selectedAnomaly.reason}
                        </div>

                        <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-slate-400">
                          <span>Lonjakan Volume:</span>
                          <span className="font-mono font-bold text-white">
                            {selectedAnomaly.volumeSpike}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sumber: Sectors v2 Company Report</span>
                      <span>Sistem Evaluasi: P/E & P/B Sanity Test</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MARKET RADAR LIVE FEED */}
        {activeTab === 'radar' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Radar className="h-6 w-6 text-rose-500 animate-pulse" />
                  Live Market Radar & Catalyst Divergence
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Memindai berita emiten dan pelaporan insider terkini di BEI untuk mendeteksi emiten
                  &ldquo;Sleeping Giant&rdquo; yang belum merespons berita.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsLoadingRadar(true)
                  void loadRadar()
                }}
                disabled={isLoadingRadar}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                <RefreshCcw className={cn('h-3.5 w-3.5', isLoadingRadar && 'animate-spin')} />
                {isLoadingRadar ? 'Memindai...' : 'Refresh Radar'}
              </button>
            </div>

            {/* Sleeping Giants Alerts Stream */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Saham &ldquo;Sleeping Giant&rdquo; Terdeteksi (Katalis Belum Ter-price In)
              </h3>

              {isLoadingRadar ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-rose-400 mb-2" />
                  Memindai data berita dan transaksi IDX...
                </div>
              ) : radarData?.sleepingGiants && radarData.sleepingGiants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {radarData.sleepingGiants.map((item, idx) => (
                    <motion.div
                      key={`${item.ticker}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 backdrop-blur-xl hover:border-emerald-500/60 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => void handleAnalyze(item.ticker)}
                            className="font-mono text-xl font-bold text-white hover:text-rose-400 cursor-pointer underline decoration-dotted"
                          >
                            {item.ticker}
                          </span>
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            Impact: +{item.impactScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleQuickAddWatchlist(item.ticker, item.ticker, `Sleeping Giant: ${item.headline}`)}
                            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            <Star className="h-3 w-3 text-amber-400" />
                            + Watchlist
                          </button>
                          <button
                            onClick={() => void handleAnalyze(item.ticker)}
                            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
                          >
                            Analyze →
                          </button>
                        </div>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-white leading-snug">
                        {item.headline}
                      </p>
                      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                        {item.verdict}
                      </p>

                      <div className="mt-4 pt-3 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Status: Katalis Terbit</span>
                        <span>{item.timestamp?.split('T')[0] ?? 'Hari ini'}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-slate-400">
                  Tidak ada anomali divergensi ekstrem saat ini. Semua berita emiten terkini sudah
                  terealisasi di harga pasar.
                </div>
              )}
            </div>

            {/* Insider Unusual Movements Stream */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Radar Pergerakan Insider Aneh Terkini
              </h3>

              {radarData?.insiderAlerts && radarData.insiderAlerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {radarData.insiderAlerts.map((item, idx) => (
                    <div
                      key={`${item.ticker}-${idx}`}
                      className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 backdrop-blur-xl hover:border-rose-500/60 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => void handleAnalyze(item.ticker)}
                            className="font-mono text-xl font-bold text-white hover:text-rose-400 cursor-pointer underline decoration-dotted"
                          >
                            {item.ticker}
                          </span>
                          <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleQuickAddWatchlist(item.ticker, item.ticker, `Insider Move: ${item.holderName} (${item.action})`)}
                            className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30"
                          >
                            <Star className="h-3 w-3 text-amber-400" />
                            + Watchlist
                          </button>
                          <button
                            onClick={() => void handleAnalyze(item.ticker)}
                            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
                          >
                            Analyze →
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-white font-semibold">
                        {item.holderName} ({item.action}) • Nilai: Rp {(item.valueIdr / 1_000_000_000).toFixed(1)}M
                      </div>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        {item.summary}
                      </p>

                      <div className="mt-4 pt-3 border-t border-rose-500/10 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Sumber: Pelaporan Resmi BEI</span>
                        <span>{item.timestamp?.split('T')[0] ?? 'Hari ini'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-slate-400">
                  Tidak ada transaksi insider bernilai ekstrem dalam pelaporan terakhir.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: WATCHLIST (FULL CRUD INTERFACE) */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Bookmark className="h-6 w-6 text-emerald-400" />
                  Watchlist Portofolio & Radar
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Kelola saham pantauan Anda, tentukan target harga, prioritas trading, dan simpan catatan riset secara lokal.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingWatchlist({
                      ticker: '',
                      name: '',
                      targetPrice: '',
                      notes: '',
                      priority: 'MEDIUM',
                      status: 'WATCHING',
                    })
                    setIsWatchlistModalOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Saham
                </button>
                <button
                  onClick={() => {
                    setIsLoadingWatchlist(true)
                    void loadWatchlistData()
                  }}
                  disabled={isLoadingWatchlist}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                >
                  <RefreshCcw className={cn('h-3.5 w-3.5', isLoadingWatchlist && 'animate-spin')} />
                </button>
              </div>
            </div>

            {watchlistItems.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#0A0D14]/80 p-12 text-center backdrop-blur-md">
                <Bookmark className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-lg font-bold text-white">Watchlist Masih Kosong</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Tambahkan saham dari Terminal, Market Radar, atau klik tombol Tambah Saham di atas untuk mulai mencatat target harga.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchlistItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border border-white/10 bg-[#0A0D14]/90 p-5 backdrop-blur-xl shadow-lg hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => void handleAnalyze(item.ticker)}
                              className="font-mono text-xl font-bold text-white hover:text-rose-400 cursor-pointer underline decoration-dotted"
                            >
                              {item.ticker}
                            </span>
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-[9px] font-extrabold uppercase',
                                item.priority === 'HIGH'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : item.priority === 'MEDIUM'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                              )}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate w-44 mt-0.5">{item.name}</p>
                        </div>

                        {item.targetPrice && (
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase">Target Price</div>
                            <div className="font-mono text-xs font-bold text-emerald-400">
                              {item.targetPrice}
                            </div>
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <p className="mt-3 text-xs text-slate-300 bg-white/[0.02] p-2.5 rounded-xl border border-white/5 leading-relaxed">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <button
                        onClick={() => void handleAnalyze(item.ticker)}
                        className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        Buka Terminal →
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingWatchlist(item)
                            setIsWatchlistModalOpen(true)
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                          title="Edit Catatan & Target"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDeleteWatchlist(item.id, item.ticker)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                          title="Hapus dari Watchlist"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WATCHLIST & DATABASE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Layers className="h-6 w-6 text-indigo-400" />
                  Riwayat Analisis Tersimpan di Database
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Setiap analisis disimpan permanen di PostgreSQL lokal dan dapat ditinjau kembali
                  kapan saja tanpa mengurangi kuota API Sectors.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsLoadingHistory(true)
                  void loadHistory()
                }}
                disabled={isLoadingHistory}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                <RefreshCcw className={cn('h-3.5 w-3.5', isLoadingHistory && 'animate-spin')} />
                {isLoadingHistory ? 'Memuat...' : 'Refresh Riwayat'}
              </button>
            </div>

            {anomalies.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                Belum ada data analisis tersimpan di database. Silakan analisis kode saham di atas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    onClick={() => {
                      setSelectedAnomaly(anomaly)
                      setActiveTab('terminal')
                    }}
                    className={cn(
                      'cursor-pointer rounded-2xl border p-4 transition-all',
                      selectedAnomaly?.id === anomaly.id
                        ? 'border-rose-500/60 bg-rose-500/10 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-white">
                            {anomaly.ticker}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase',
                              anomaly.status === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : anomaly.status === 'HIGH'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                  : anomaly.status === 'WARNING'
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
                            )}
                          >
                            {anomaly.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 truncate w-48">{anomaly.name}</p>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <div className="font-bold text-white">{anomaly.price}</div>
                        <div
                          className={cn(
                            anomaly.change.startsWith('+')
                              ? 'text-emerald-400'
                              : anomaly.change.startsWith('-')
                                ? 'text-rose-400'
                                : 'text-slate-400',
                          )}
                        >
                          {anomaly.change}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-slate-400">
                      <span>Volume: {anomaly.volumeSpike}</span>
                      <span>
                        {new Date(anomaly.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: Watchlist Add / Edit Dialog */}
      {isWatchlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0D111A] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-emerald-400" />
                {editingWatchlist?.id ? 'Edit Watchlist' : 'Tambah ke Watchlist'}
              </h3>
              <button
                onClick={() => {
                  setIsWatchlistModalOpen(false)
                  setEditingWatchlist(null)
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWatchlist} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Kode Saham (Ticker)</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingWatchlist?.id)}
                  value={editingWatchlist?.ticker || ''}
                  onChange={(e) =>
                    setEditingWatchlist((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. BBCA"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white font-mono uppercase focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Target Price (Opsional)</label>
                <input
                  type="text"
                  value={editingWatchlist?.targetPrice || ''}
                  onChange={(e) =>
                    setEditingWatchlist((prev) => ({ ...prev, targetPrice: e.target.value }))
                  }
                  placeholder="e.g. Rp 6.800"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Prioritas</label>
                  <select
                    value={editingWatchlist?.priority || 'MEDIUM'}
                    onChange={(e) =>
                      setEditingWatchlist((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#161B26] p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="HIGH">HIGH (Tinggi)</option>
                    <option value="MEDIUM">MEDIUM (Sedang)</option>
                    <option value="LOW">LOW (Rendah)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Status Saham</label>
                  <select
                    value={editingWatchlist?.status || 'WATCHING'}
                    onChange={(e) =>
                      setEditingWatchlist((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#161B26] p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="WATCHING">Watching</option>
                    <option value="SLEEPING_GIANT">Sleeping Giant</option>
                    <option value="ACCUMULATING">Accumulating</option>
                    <option value="BOUGHT">Sudah Beli</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Catatan Riset / Trading Plan</label>
                <textarea
                  rows={3}
                  value={editingWatchlist?.notes || ''}
                  onChange={(e) =>
                    setEditingWatchlist((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Contoh: Akumulasi asing kuat, tunggu breakout resisten 6.450..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWatchlistModalOpen(false)
                    setEditingWatchlist(null)
                  }}
                  className="rounded-xl px-4 py-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 font-bold text-white hover:brightness-110 shadow-lg"
                >
                  Simpan Watchlist
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: Broker Details Inspector */}
      {selectedBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0D111A] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-purple-500/20 px-2 py-1 font-mono text-base font-black text-purple-300 border border-purple-500/40">
                  {selectedBroker.code}
                </span>
                <span className="font-bold text-white text-sm">{selectedBroker.name}</span>
              </div>
              <button
                onClick={() => setSelectedBroker(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Asal Broker:</span>
                <span className="font-bold text-white">
                  {selectedBroker.isForeign ? 'Asing (Foreign)' : 'Domestik (Local)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Kohort / Kategori:</span>
                <span className="font-bold uppercase text-purple-400">
                  {selectedBroker.cohort}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Volume Transaksi:</span>
                <span className="font-mono text-white font-semibold">
                  {selectedBroker.lot.toLocaleString('id-ID')} Lot
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Nilai Transaksi:</span>
                <span className="font-mono text-white font-semibold">
                  Rp {(selectedBroker.value / 1_000_000_000).toFixed(2)} Miliar
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Harga Rata-Rata:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  Rp {selectedBroker.avgPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setSelectedBroker(null)}
                className="w-full rounded-xl bg-white/10 py-2 font-semibold text-white hover:bg-white/20 text-xs"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
