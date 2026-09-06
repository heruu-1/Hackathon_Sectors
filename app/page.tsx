'use client'

import { useEffect, useState } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  BarChart2,
  ChevronRight,
  Loader2,
  Radar,
  RefreshCcw,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { analyzeTicker, getRecentAnomalies } from './actions'

export default function Home() {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [selectedAnomaly, setSelectedAnomaly] = useState<any | null>(null)
  const [isScanning, setIsScanning] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const res = await getRecentAnomalies()
      if (res.success && res.data && res.data.length > 0) {
        setAnomalies(res.data)
        setSelectedAnomaly(res.data[0])
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchInput.trim()) return

    setIsAnalyzing(true)
    setErrorMsg('')

    try {
      const result = await analyzeTicker(searchInput)
      if (result.error) {
        setErrorMsg(result.error)
      } else if (result.data) {
        setAnomalies([result.data, ...anomalies])
        setSelectedAnomaly(result.data)
        setSearchInput('')
      }
    } catch (err) {
      setErrorMsg('Failed to analyze. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] font-sans text-slate-200 selection:bg-rose-500/30">
      {/* Background Glow Effects */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 opacity-20">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 mix-blend-screen blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Radar className="h-5 w-5 animate-pulse text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                RASI
              </h1>
              <p className="text-[10px] font-medium tracking-widest text-rose-400 uppercase">
                Report Analisis Saham Indonesia
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
              System Active
            </div>

            <form onSubmit={handleAnalyze} className="relative flex items-center">
              <input
                type="text"
                placeholder="Enter Ticker (e.g., BBCA)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                disabled={isAnalyzing}
                className="h-10 w-64 rounded-lg border border-white/10 bg-white/5 pr-24 pl-4 text-sm text-white transition-all placeholder:text-slate-500 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isAnalyzing}
                className="absolute right-1 flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
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
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {errorMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            {errorMsg}
          </div>
        )}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Live Feed */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="h-5 w-5 text-rose-500" />
                Live Anomaly Feed
              </h2>
              <button
                onClick={() => setIsScanning(!isScanning)}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
              >
                <RefreshCcw className={cn('h-3 w-3', isScanning && 'animate-spin')} />
                {isScanning ? 'Scanning...' : 'Paused'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading database...
                </div>
              ) : anomalies.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No data found. Analyze a ticker to start.
                </div>
              ) : (
                <AnimatePresence>
                  {anomalies.map((anomaly, idx) => (
                    <motion.div
                      key={anomaly.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => setSelectedAnomaly(anomaly)}
                      className={cn(
                        'cursor-pointer rounded-2xl border p-4 transition-all duration-300',
                        selectedAnomaly?.id === anomaly.id
                          ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-lg font-bold text-white">{anomaly.ticker}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider',
                                anomaly.status === 'CRITICAL'
                                  ? 'border border-rose-500/30 bg-rose-500/20 text-rose-400'
                                  : anomaly.status === 'HIGH'
                                    ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                                    : anomaly.status === 'WARNING'
                                      ? 'border border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
                                      : 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
                              )}
                            >
                              {anomaly.status}
                            </span>
                          </div>
                          <p className="w-48 truncate text-sm text-slate-400">{anomaly.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-white">{anomaly.price}</div>
                          <div className="text-sm font-medium text-emerald-400">
                            {anomaly.change}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-300">
                          <ShieldAlert
                            className={cn(
                              'h-4 w-4',
                              anomaly.risk > 80
                                ? 'text-rose-500'
                                : anomaly.risk > 50
                                  ? 'text-orange-500'
                                  : anomaly.risk > 30
                                    ? 'text-yellow-500'
                                    : 'text-emerald-500',
                            )}
                          />
                          Risk Score: <span className="font-bold text-white">{anomaly.risk}%</span>
                        </div>
                        <span className="text-xs text-slate-500">{anomaly.time || 'Just now'}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Right Column: Detailed Analysis */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {selectedAnomaly && (
                <motion.div
                  key={selectedAnomaly.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] p-8"
                >
                  {/* Background Decor */}
                  <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-rose-500/5 blur-[120px]" />

                  <div className="relative z-10 mb-8 flex items-start justify-between">
                    <div>
                      <h3 className="mb-2 text-3xl font-bold text-white">
                        {selectedAnomaly.ticker} Analysis
                      </h3>
                      <p className="text-slate-400">{selectedAnomaly.name}</p>
                    </div>
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-rose-500/20">
                      <svg className="absolute inset-0 h-full w-full -rotate-90">
                        <circle
                          cx="36"
                          cy="36"
                          r="34"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className={cn(
                            selectedAnomaly.risk > 80
                              ? 'text-rose-500'
                              : selectedAnomaly.risk > 50
                                ? 'text-orange-500'
                                : selectedAnomaly.risk > 30
                                  ? 'text-yellow-500'
                                  : 'text-emerald-500',
                          )}
                          strokeDasharray="213"
                          strokeDashoffset={213 - (213 * selectedAnomaly.risk) / 100}
                        />
                      </svg>
                      <div className="text-center">
                        <div className="text-xl font-bold text-white">{selectedAnomaly.risk}</div>
                        <div className="text-[10px] font-bold text-rose-400 uppercase">Risk</div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mb-8 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                      <div className="mb-2 flex items-center gap-2 text-slate-400">
                        <BarChart2 className="h-4 w-4" />
                        Volume Spike
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {selectedAnomaly.volumeSpike}
                      </div>
                      <div className="mt-1 text-sm text-rose-400">vs 30-day average</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                      <div className="mb-2 flex items-center gap-2 text-slate-400">
                        <TrendingUp className="h-4 w-4" />
                        Price Action
                      </div>
                      <div className="text-3xl font-bold text-white">{selectedAnomaly.change}</div>
                      <div className="mt-1 text-sm text-rose-400">Intraday movement</div>
                    </div>
                  </div>

                  <div className="relative z-10 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-rose-400">
                      <AlertTriangle className="h-5 w-5" />
                      AI Manipulation Warning
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {selectedAnomaly.reason}
                    </p>

                    <div className="mt-6 flex items-center justify-between border-t border-rose-500/10 pt-6">
                      <div className="text-sm text-slate-400">
                        Fundamental Health:{' '}
                        <span className="font-medium text-white">
                          {selectedAnomaly.risk > 80
                            ? 'Poor'
                            : selectedAnomaly.risk > 50
                              ? 'Fair'
                              : 'Good'}
                        </span>
                      </div>
                      <button className="flex items-center gap-1 text-sm font-medium text-rose-400 transition-colors hover:text-rose-300">
                        View Fundamental Report <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}
