'use client'

import { useId, useMemo, useState } from 'react'

import { Activity, BarChart2, Calendar, CandlestickChart, LineChart, Sparkles } from 'lucide-react'

import { TradingViewChart } from '@/components/TradingViewChart'
import type { DailyPriceRow } from '@/lib/contracts/market'
import { calculatePriceSma20, formatCurrencyIdr } from '@/lib/presentation/stock'

export interface StockChartProps {
  dailyRows: DailyPriceRow[]
  symbol: string
}

/**
 * Generates a smooth Catmull-Rom cubic bezier path for SVG.
 */
function getSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return d
}

/**
 * Calculates human-friendly round tick marks for the Y axis.
 */
function getNiceYAxisTicks(min: number, max: number, targetCount = 4): number[] {
  if (min >= max) return [min]
  const range = max - min
  const rawStep = range / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude

  let step = magnitude
  if (normalized < 1.5) step = 1 * magnitude
  else if (normalized < 3.5) step = 2 * magnitude
  else if (normalized < 7.5) step = 5 * magnitude
  else step = 10 * magnitude

  const firstTick = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = firstTick; v <= max + step * 0.01; v += step) {
    ticks.push(v)
  }

  return ticks
}

export function StockChart({ dailyRows, symbol }: StockChartProps) {
  const chartId = useId()
  const [viewSource, setViewSource] = useState<'tradingview' | 'rasi'>('tradingview')

  // RASI Chart states
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle')
  const [period, setPeriod] = useState<'30' | 'all'>('30')
  const [showSma20, setShowSma20] = useState(true)

  // 1. Sort rows chronologically
  const allSortedRows = useMemo(() => {
    if (!dailyRows || dailyRows.length === 0) return []
    return [...dailyRows]
      .filter((r) => r && typeof r.date === 'string' && Number.isFinite(r.close))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyRows])

  // 2. Filter rows based on selected period
  const sortedRows = useMemo(() => {
    if (period === '30') {
      return allSortedRows.slice(-30)
    }
    return allSortedRows
  }, [allSortedRows, period])

  // 3. Calculate SMA-20 based on all rows to ensure historical accuracy
  const allSma20Values = useMemo(() => {
    return calculatePriceSma20(allSortedRows)
  }, [allSortedRows])

  // Map SMA-20 values to the active visible rows
  const visibleSma20Values = useMemo(() => {
    return sortedRows.map((row) => {
      const originalIdx = allSortedRows.findIndex((r) => r.date === row.date)
      return originalIdx >= 0 ? allSma20Values[originalIdx] : null
    })
  }, [sortedRows, allSortedRows, allSma20Values])

  const count = sortedRows.length
  const hasSma = visibleSma20Values.some((v) => v !== null)

  // 4. Reverse chronological rows for table view
  const tableRows = useMemo(() => {
    return [...allSortedRows].reverse().slice(0, 30)
  }, [allSortedRows])

  // 5. Summary metrics for the active period
  const metrics = useMemo(() => {
    if (sortedRows.length === 0) return null
    const highs = sortedRows.map((r) => r.high ?? r.close)
    const lows = sortedRows.map((r) => r.low ?? r.close)
    const volumes = sortedRows.map((r) => r.volume || 0)

    const highest = Math.max(...highs)
    const lowest = Math.min(...lows)
    const avgVolume = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)

    const firstClose = sortedRows[0].close
    const lastClose = sortedRows[sortedRows.length - 1].close
    const returnPct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0

    return {
      highest,
      lowest,
      avgVolume,
      lastClose,
      returnPct,
    }
  }, [sortedRows])

  if (allSortedRows.length === 0) {
    return (
      <div className="space-y-4">
        <TradingViewChart symbol={symbol} height={620} />
        <div className="rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-[var(--rasi-muted)]" aria-hidden="true" />
          <p className="font-semibold text-[var(--rasi-text)]">Data riwayat harga belum tersedia</p>
          <p className="mt-1 text-xs"> Riwayat harga harian belum tersedia untuk {symbol}.</p>
        </div>
      </div>
    )
  }

  // 6. SVG Dimensions & Coordinate System for RASI Chart
  const chartWidth = 740
  const chartHeight = 310
  const padding = { top: 25, right: 65, bottom: 45, left: 15 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  const priceAreaHeight = innerHeight * 0.72
  const volumeAreaHeight = innerHeight * 0.22
  const volumeAreaTop = padding.top + innerHeight - volumeAreaHeight

  const allCloses = sortedRows.map((r) => r.close)
  const allHighs = sortedRows.map((r) => r.high ?? r.close)
  const allLows = sortedRows.map((r) => r.low ?? r.close)
  const validSma = showSma20 ? visibleSma20Values.filter((v): v is number => v !== null) : []

  const rawMinPrice = Math.min(...allLows, ...(validSma.length > 0 ? validSma : allCloses))
  const rawMaxPrice = Math.max(...allHighs, ...(validSma.length > 0 ? validSma : allCloses))
  const priceMargin = (rawMaxPrice - rawMinPrice) * 0.08 || 50
  const minPrice = Math.max(0, rawMinPrice - priceMargin)
  const maxPrice = rawMaxPrice + priceMargin
  const priceRange = maxPrice - minPrice || 1

  const volumes = sortedRows.map((r) => r.volume || 0)
  const maxVolume = Math.max(...volumes, 1)

  const getX = (idx: number) => padding.left + (idx / Math.max(count - 1, 1)) * innerWidth
  const getYPrice = (val: number) =>
    padding.top + (1 - (val - minPrice) / priceRange) * priceAreaHeight
  const getYVolHeight = (val: number) => (val / maxVolume) * volumeAreaHeight

  const pricePoints = sortedRows.map((r, i) => ({
    x: getX(i),
    y: getYPrice(r.close),
  }))
  const smoothPricePath = getSmoothSplinePath(pricePoints)

  const areaPath =
    pricePoints.length > 0
      ? `${smoothPricePath} L ${pricePoints[pricePoints.length - 1].x.toFixed(1)} ${(padding.top + priceAreaHeight).toFixed(1)} L ${pricePoints[0].x.toFixed(1)} ${(padding.top + priceAreaHeight).toFixed(1)} Z`
      : ''

  const smaPoints: { x: number; y: number }[] = []
  if (showSma20) {
    for (let i = 0; i < count; i++) {
      const val = visibleSma20Values[i]
      if (val !== null) {
        smaPoints.push({ x: getX(i), y: getYPrice(val) })
      }
    }
  }
  const smoothSmaPath = getSmoothSplinePath(smaPoints)

  const yTicks = getNiceYAxisTicks(minPrice, maxPrice, 4)

  const activeIdx = hoverIndex !== null ? Math.min(hoverIndex, count - 1) : count - 1
  const activeRow = sortedRows[activeIdx] ?? null
  const activeSma = showSma20 ? (visibleSma20Values[activeIdx] ?? null) : null
  const prevRow = activeIdx > 0 ? sortedRows[activeIdx - 1] : null
  const activeDailyChange =
    activeRow && prevRow && prevRow.close > 0
      ? ((activeRow.close - prevRow.close) / prevRow.close) * 100
      : null

  return (
    <div className="space-y-6">
      {/* Chart Engine Switcher Tabs */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-1">
          <button
            type="button"
            aria-pressed={viewSource === 'tradingview'}
            onClick={() => setViewSource('tradingview')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewSource === 'tradingview'
                ? 'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-sm'
                : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            TradingView
          </button>
          <button
            type="button"
            aria-pressed={viewSource === 'rasi'}
            onClick={() => setViewSource('rasi')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewSource === 'rasi'
                ? 'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-sm'
                : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Grafik RASI{' '}
          </button>
        </div>

        <span className="text-xs text-[var(--rasi-muted)]">
          {viewSource === 'tradingview'
            ? 'Pilih rentang waktu, tambahkan garis, dan lihat perhitungan pada grafik'
            : 'Riwayat harga dari Sectors dan rata-rata harga 20 hari bursa (SMA-20)'}
        </span>
      </div>

      {/* VIEW 1: TRADINGVIEW OFFICIAL PRO CHART */}
      {viewSource === 'tradingview' && (
        <div className="space-y-3">
          <TradingViewChart symbol={symbol} height={620} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--rasi-muted)]">
            <span>
              {' '}
              Grafik dari TradingView untuk <strong>IDX:{symbol}</strong>
            </span>
            <span> Gulir untuk memperbesar; geser grafik untuk melihat tanggal lain </span>
          </div>
        </div>
      )}

      {/* VIEW 2: RASI INTERNAL SVG CHART */}
      {viewSource === 'rasi' && (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-[var(--rasi-card-shadow)] sm:p-6">
          {/* Header with Title & Quick Controls */}
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--rasi-border)] pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-[var(--rasi-text)]">
                  Pergerakan Harga & Volume
                </h3>
                <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--rasi-primary)]">
                  {symbol}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                Menampilkan {count} hari perdagangan{' '}
                {hasSma
                  ? ' · Garis rata-rata muncul setelah tersedia 20 hari perdagangan'
                  : ' · Garis rata-rata membutuhkan 20 hari perdagangan'}
              </p>
            </div>

            {/* Controls: Period, Indicators, and Chart Type */}
            <div className="flex flex-wrap items-center gap-2">
              {/* SMA-20 Toggle */}
              <button
                type="button"
                aria-pressed={showSma20}
                onClick={() => setShowSma20((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                  showSma20
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-[#181102] dark:text-amber-300'
                    : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    showSma20 ? 'bg-amber-500' : 'bg-[var(--rasi-muted)]'
                  }`}
                />
                SMA-20
              </button>

              {/* Period Selector */}
              <div className="flex rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-0.5 text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={period === '30'}
                  onClick={() => setPeriod('30')}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    period === '30'
                      ? 'bg-[var(--rasi-surface)] font-bold text-[var(--rasi-primary)] shadow-xs'
                      : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  {' '}
                  30 hari bursa{' '}
                </button>
                <button
                  type="button"
                  aria-pressed={period === 'all'}
                  onClick={() => setPeriod('all')}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    period === 'all'
                      ? 'bg-[var(--rasi-surface)] font-bold text-[var(--rasi-primary)] shadow-xs'
                      : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  Semua ({allSortedRows.length})
                </button>
              </div>

              {/* Type Selector */}
              <div className="flex rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-0.5 text-xs">
                <button
                  type="button"
                  aria-pressed={chartType === 'line'}
                  onClick={() => setChartType('line')}
                  title="Garis & Area"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all ${
                    chartType === 'line'
                      ? 'bg-[var(--rasi-surface)] font-bold text-[var(--rasi-primary)] shadow-xs'
                      : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  <LineChart className="h-3.5 w-3.5" />
                  Garis
                </button>
                <button
                  type="button"
                  aria-pressed={chartType === 'candle'}
                  onClick={() => setChartType('candle')}
                  title="Lilin Jepang (Candlestick)"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all ${
                    chartType === 'candle'
                      ? 'bg-[var(--rasi-surface)] font-bold text-[var(--rasi-primary)] shadow-xs'
                      : 'text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  <CandlestickChart className="h-3.5 w-3.5" />
                  Lilin
                </button>
              </div>
            </div>
          </div>

          {/* Quick Period Stat Chips */}
          {metrics && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
                <span className="text-[11px] font-medium text-[var(--rasi-muted)]">
                  Harga Terakhir
                </span>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-base font-bold text-[var(--rasi-text)]">
                    {formatCurrencyIdr(metrics.lastClose)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      metrics.returnPct >= 0
                        ? 'text-[var(--rasi-success)]'
                        : 'text-[var(--rasi-danger)]'
                    }`}
                  >
                    {metrics.returnPct >= 0 ? '+' : ''}
                    {metrics.returnPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
                <span className="text-[11px] font-medium text-[var(--rasi-muted)]">
                  Tertinggi ({period === '30' ? '30 hari bursa' : 'Periode'})
                </span>
                <p className="mt-0.5 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyIdr(metrics.highest)}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
                <span className="text-[11px] font-medium text-[var(--rasi-muted)]">
                  Terendah ({period === '30' ? '30 hari bursa' : 'Periode'})
                </span>
                <p className="mt-0.5 font-mono text-base font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrencyIdr(metrics.lowest)}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
                <span className="text-[11px] font-medium text-[var(--rasi-muted)]">
                  {' '}
                  Rata-rata jumlah saham diperdagangkan{' '}
                </span>
                <p className="mt-0.5 font-mono text-base font-bold text-[var(--rasi-text)]">
                  {(metrics.avgVolume / 1_000_000).toFixed(1)} Jt
                </p>
              </div>
            </div>
          )}

          {/* Interactive HUD / Crosshair Readout Bar */}
          <div className="mt-4 flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-4 py-2 text-xs">
            {activeRow ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                <div className="flex items-center gap-1.5 font-sans font-bold text-[var(--rasi-text)]">
                  <Calendar className="h-3.5 w-3.5 text-[var(--rasi-primary)]" />
                  {activeRow.date}
                </div>
                <div>
                  <span className="text-[var(--rasi-muted)]">Buka: </span>
                  <span className="font-semibold text-[var(--rasi-text)]">
                    {formatCurrencyIdr(activeRow.open ?? activeRow.close)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--rasi-muted)]">Tinggi: </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyIdr(activeRow.high ?? activeRow.close)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--rasi-muted)]">Rendah: </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {formatCurrencyIdr(activeRow.low ?? activeRow.close)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--rasi-muted)]">Tutup: </span>
                  <strong className="font-bold text-[var(--rasi-primary)]">
                    {formatCurrencyIdr(activeRow.close)}
                  </strong>
                  {activeDailyChange !== null && (
                    <span
                      className={`ml-1 font-sans text-[11px] font-semibold ${
                        activeDailyChange >= 0
                          ? 'text-[var(--rasi-success)]'
                          : 'text-[var(--rasi-danger)]'
                      }`}
                    >
                      ({activeDailyChange >= 0 ? '+' : ''}
                      {activeDailyChange.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[var(--rasi-muted)]">Vol: </span>
                  <span className="font-semibold text-[var(--rasi-text)]">
                    {activeRow.volume.toLocaleString('id-ID')}
                  </span>
                </div>
                {showSma20 && activeSma !== null && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>SMA-20: </span>
                    <strong className="font-bold">{formatCurrencyIdr(activeSma)}</strong>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[var(--rasi-muted)]">
                {' '}
                Arahkan penunjuk ke grafik untuk melihat harga pada tanggal tersebut{' '}
              </span>
            )}

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--rasi-muted)]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-[var(--rasi-primary)]" />
                Harga
              </span>
              {showSma20 && hasSma && (
                <span className="flex items-center gap-1 text-amber-500">
                  <span className="h-0.5 w-3 bg-amber-500" />
                  SMA-20
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-emerald-500" />
                Naik
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-rose-500" />
                Turun
              </span>
            </div>
          </div>

          {/* SVG Chart Canvas */}
          <div className="relative mt-3 w-full overflow-hidden select-none">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-auto w-full overflow-visible"
              aria-label={`Grafik harga penutupan dan volume ${symbol}`}
            >
              <defs>
                <linearGradient id={`price-grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--rasi-primary)" stopOpacity="0.32" />
                  <stop offset="50%" stopColor="var(--rasi-primary)" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="var(--rasi-primary)" stopOpacity="0.0" />
                </linearGradient>

                <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Grid Lines and Price Labels (Right Side) */}
              {yTicks.map((val) => {
                const y = getYPrice(val)
                if (y < padding.top || y > padding.top + priceAreaHeight) return null
                return (
                  <g key={`ytick-${val}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="var(--rasi-border)"
                      strokeDasharray="4 4"
                      strokeWidth="0.8"
                      strokeOpacity="0.8"
                    />
                    <text
                      x={chartWidth - padding.right + 8}
                      y={y + 3.5}
                      textAnchor="start"
                      className="fill-[var(--rasi-muted)] font-mono text-[10px] tabular-nums"
                    >
                      {val.toLocaleString('id-ID')}
                    </text>
                  </g>
                )
              })}

              {/* Volume Separator Line */}
              <line
                x1={padding.left}
                y1={volumeAreaTop}
                x2={chartWidth - padding.right}
                y2={volumeAreaTop}
                stroke="var(--rasi-border)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                strokeOpacity="0.5"
              />
              <text
                x={chartWidth - padding.right + 8}
                y={volumeAreaTop + 10}
                textAnchor="start"
                className="fill-[var(--rasi-muted)]/60 font-mono text-[9px]"
              >
                VOL
              </text>

              {/* Volume Bars */}
              {sortedRows.map((r, i) => {
                const barHeight = Math.max(getYVolHeight(r.volume || 0), 1.5)
                const barWidth = Math.max((innerWidth / count) * 0.65, 2.5)
                const x = getX(i) - barWidth / 2
                const y = chartHeight - padding.bottom - barHeight
                const isHovered = hoverIndex === i
                const isBullish = r.close >= (r.open ?? r.close)

                return (
                  <rect
                    key={`vol-${r.date}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="1"
                    className={`transition-opacity ${
                      isBullish
                        ? isHovered
                          ? 'fill-emerald-500 opacity-100'
                          : 'fill-emerald-500/40 hover:fill-emerald-500/70'
                        : isHovered
                          ? 'fill-rose-500 opacity-100'
                          : 'fill-rose-500/40 hover:fill-rose-500/70'
                    }`}
                  />
                )
              })}

              {/* CHART TYPE 1: SMOOTH AREA & LINE */}
              {chartType === 'line' && (
                <>
                  {areaPath && <path d={areaPath} fill={`url(#price-grad-${chartId})`} />}
                  {smoothPricePath && (
                    <path
                      d={smoothPricePath}
                      fill="none"
                      stroke="var(--rasi-primary)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </>
              )}

              {/* CHART TYPE 2: JAPANESE CANDLESTICK */}
              {chartType === 'candle' && (
                <g id="candlesticks">
                  {sortedRows.map((r, i) => {
                    const x = getX(i)
                    const candleWidth = Math.max(Math.min((innerWidth / count) * 0.68, 12), 3)

                    const open = r.open ?? r.close
                    const close = r.close
                    const high = r.high ?? Math.max(open, close)
                    const low = r.low ?? Math.min(open, close)

                    const openY = getYPrice(open)
                    const closeY = getYPrice(close)
                    const highY = getYPrice(high)
                    const lowY = getYPrice(low)

                    const isBullish = close >= open
                    const bodyY = Math.min(openY, closeY)
                    const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5)

                    const colorClass = isBullish
                      ? 'stroke-emerald-500 fill-emerald-500'
                      : 'stroke-rose-500 fill-rose-500'

                    return (
                      <g key={`candle-${r.date}`} className={colorClass}>
                        <line
                          x1={x}
                          y1={highY}
                          x2={x}
                          y2={lowY}
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <rect
                          x={x - candleWidth / 2}
                          y={bodyY}
                          width={candleWidth}
                          height={bodyHeight}
                          rx="1"
                          strokeWidth="1"
                        />
                      </g>
                    )
                  })}
                </g>
              )}

              {/* SMA-20 Smooth Line */}
              {showSma20 && hasSma && smoothSmaPath && (
                <path
                  d={smoothSmaPath}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
              )}

              {/* Interactive Vertical Crosshair & Focus Dot */}
              {hoverIndex !== null && sortedRows[hoverIndex] && (
                <g id="crosshair">
                  <line
                    x1={getX(hoverIndex)}
                    y1={padding.top}
                    x2={getX(hoverIndex)}
                    y2={chartHeight - padding.bottom}
                    stroke="var(--rasi-primary)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    strokeOpacity="0.8"
                  />

                  <circle
                    cx={getX(hoverIndex)}
                    cy={getYPrice(sortedRows[hoverIndex].close)}
                    r="5"
                    className="fill-[var(--rasi-primary)] stroke-[var(--rasi-surface)]"
                    strokeWidth="2.5"
                    filter={`url(#glow-${chartId})`}
                  />

                  {showSma20 && visibleSma20Values[hoverIndex] !== null && (
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getYPrice(visibleSma20Values[hoverIndex]!)}
                      r="4"
                      fill="#F59E0B"
                      className="stroke-[var(--rasi-surface)]"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}

              {/* Date Axis Markers */}
              {[...new Set([0, Math.floor(count / 2), count - 1])].map((idx) => {
                if (idx < 0 || idx >= count) return null
                const row = sortedRows[idx]
                return (
                  <text
                    key={`date-${idx}`}
                    x={getX(idx)}
                    y={chartHeight - 14}
                    textAnchor={idx === 0 ? 'start' : idx === count - 1 ? 'end' : 'middle'}
                    className="fill-[var(--rasi-muted)] font-mono text-[10px]"
                  >
                    {row.date}
                  </text>
                )
              })}

              {/* Invisible Hover Overlay Columns */}
              {sortedRows.map((r, i) => {
                const colWidth = innerWidth / count
                return (
                  <rect
                    key={`hover-col-${r.date}`}
                    x={getX(i) - colWidth / 2}
                    y={padding.top}
                    width={colWidth}
                    height={innerHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-crosshair"
                  />
                )
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Accessible Historical Data Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] shadow-[var(--rasi-card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--rasi-border)] px-5 py-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--rasi-text)]">
              {' '}
              Riwayat harga dan jumlah transaksi{' '}
            </h4>
            <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
              {' '}
              Data 30 hari perdagangan terakhir. SMA-20 adalah rata-rata harga penutupan selama 20
              hari perdagangan.{' '}
            </p>
          </div>
          <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-1 font-mono text-xs text-[var(--rasi-muted)]">
            {' '}
            30 hari bursa{' '}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Tabel data historis harga penutupan, volume transaksi, dan SMA-20 untuk {symbol}
            </caption>
            <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] font-semibold text-[var(--rasi-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Tanggal
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Pembukaan
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Tertinggi
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Terendah
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Penutupan
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Volume
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  SMA-20
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rasi-border)] font-mono text-[var(--rasi-text)] tabular-nums">
              {tableRows.map((row) => {
                const originalIndex = allSortedRows.findIndex((r) => r.date === row.date)
                const sma = originalIndex >= 0 ? allSma20Values[originalIndex] : null

                return (
                  <tr
                    key={row.date}
                    className="transition-colors hover:bg-[var(--rasi-muted-bg)]/30"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2.5 font-sans font-medium text-[var(--rasi-text)]"
                    >
                      {row.date}
                    </th>
                    <td className="px-4 py-2.5 text-right text-[var(--rasi-muted)]">
                      {formatCurrencyIdr(row.open)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyIdr(row.high)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400">
                      {formatCurrencyIdr(row.low)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[var(--rasi-primary)]">
                      {formatCurrencyIdr(row.close)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--rasi-muted)]">
                      {row.volume.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {sma !== null ? formatCurrencyIdr(sma) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
