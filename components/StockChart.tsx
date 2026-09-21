'use client'

import { useId, useMemo, useState } from 'react'

import { BarChart2 } from 'lucide-react'

import type { DailyPriceRow } from '@/lib/contracts/market'
import { calculatePriceSma20, formatCurrencyIdr } from '@/lib/presentation/stock'

export interface StockChartProps {
  dailyRows: DailyPriceRow[]
  symbol: string
}

export function StockChart({ dailyRows, symbol }: StockChartProps) {
  const chartId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Sort rows chronologically
  const sortedRows = useMemo(() => {
    if (!dailyRows || dailyRows.length === 0) return []
    return [...dailyRows]
      .filter((r) => r && typeof r.date === 'string' && Number.isFinite(r.close))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyRows])

  // Calculate SMA-20
  const sma20Values = useMemo(() => {
    return calculatePriceSma20(sortedRows)
  }, [sortedRows])

  const count = sortedRows.length
  const hasSma = count >= 21

  // Reverse chronological rows for table view
  const tableRows = useMemo(() => {
    return [...sortedRows].reverse().slice(0, 30)
  }, [sortedRows])

  if (count === 0) {
    return (
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]">
        <BarChart2 className="mx-auto mb-2 h-8 w-8 text-[var(--rasi-muted)]" aria-hidden="true" />
        <p className="font-semibold text-[var(--rasi-text)]">Data riwayat harga belum tersedia</p>
        <p className="mt-1 text-xs">
          Sumber data belum mengembalikan rekaman perdagangan harian untuk {symbol}.
        </p>
      </div>
    )
  }

  // Chart dimensions & scaling
  const chartWidth = 700
  const chartHeight = 260
  const padding = { top: 20, right: 20, bottom: 40, left: 55 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Price range
  const prices = sortedRows.map((r) => r.close)
  const validSma = sma20Values.filter((v): v is number => v !== null)
  const allPriceVals = [...prices, ...validSma]
  const minPrice = Math.min(...allPriceVals) * 0.98
  const maxPrice = Math.max(...allPriceVals) * 1.02
  const priceRange = maxPrice - minPrice || 1

  // Volume range
  const volumes = sortedRows.map((r) => r.volume || 0)
  const maxVolume = Math.max(...volumes, 1)

  // Map to SVG coordinates
  const getX = (idx: number) => padding.left + (idx / Math.max(count - 1, 1)) * innerWidth
  const getYPrice = (val: number) =>
    padding.top + (1 - (val - minPrice) / priceRange) * (innerHeight * 0.7)
  const getYVolHeight = (val: number) => (val / maxVolume) * (innerHeight * 0.25)

  // Build price line path
  const pricePath = sortedRows
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYPrice(r.close).toFixed(1)}`)
    .join(' ')

  // Build SMA-20 path
  let smaPath = ''
  if (hasSma) {
    let first = true
    for (let i = 0; i < count; i++) {
      const val = sma20Values[i]
      if (val !== null) {
        smaPath += `${first ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYPrice(val).toFixed(1)} `
        first = false
      }
    }
  }

  const activeRow = hoverIndex !== null && sortedRows[hoverIndex] ? sortedRows[hoverIndex] : null
  const activeSma =
    hoverIndex !== null && sma20Values[hoverIndex] !== null ? sma20Values[hoverIndex] : null

  return (
    <div className="space-y-6">
      {/* Chart container */}
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rasi-border)] pb-4">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--rasi-text)]">
              Grafik Harga & Volume Harian
            </h3>
            <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
              {count} sesi perdagangan historis {symbol}
              {hasSma
                ? ' (dilengkapi garis rata-rata SMA-20)'
                : ` (SMA-20 belum cukup: ${count}/21 sesi)`}
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-[var(--rasi-primary)]">
              <span className="h-2 w-4 rounded-full bg-[var(--rasi-primary)]" />
              Harga Penutupan
            </span>
            {hasSma && (
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="h-0.5 w-4 bg-amber-500" />
                SMA-20
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[var(--rasi-muted)]">
              <span className="h-2 w-2 rounded-xs bg-[var(--rasi-muted)]/50" />
              Volume
            </span>
          </div>
        </div>

        {/* Interactive indicator readout */}
        <div className="mt-3 flex min-h-[32px] items-center justify-between text-xs">
          {activeRow ? (
            <div className="flex flex-wrap items-center gap-4 font-mono">
              <span className="font-sans font-bold text-[var(--rasi-text)]">{activeRow.date}</span>
              <span>
                Tutup:{' '}
                <strong className="text-[var(--rasi-primary)]">
                  {formatCurrencyIdr(activeRow.close)}
                </strong>
              </span>
              <span>
                Volume: <strong>{activeRow.volume.toLocaleString('id-ID')}</strong>
              </span>
              {activeSma !== null && (
                <span className="text-amber-600 dark:text-amber-400">
                  SMA-20: <strong>{formatCurrencyIdr(activeSma)}</strong>
                </span>
              )}
            </div>
          ) : (
            <span className="text-[var(--rasi-muted)]">
              Arahkan kursor ke grafik untuk memeriksa nilai per sesi
            </span>
          )}
        </div>

        {/* SVG Chart */}
        <div className="relative mt-2 w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-auto w-full overflow-visible select-none"
            aria-label={`Grafik harga penutupan dan volume ${symbol}`}
          >
            <defs>
              <linearGradient id={`price-grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--rasi-primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--rasi-primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines and price labels */}
            {[0, 0.35, 0.7].map((fraction) => {
              const y = padding.top + fraction * innerHeight
              const priceVal = Math.round(maxPrice - (fraction / 0.7) * (maxPrice - minPrice))
              return (
                <g key={fraction}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="var(--rasi-border)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[var(--rasi-muted)] font-mono text-[10px] tabular-nums"
                  >
                    {priceVal.toLocaleString('id-ID')}
                  </text>
                </g>
              )
            })}

            {/* Volume Bars */}
            {sortedRows.map((r, i) => {
              const barHeight = getYVolHeight(r.volume || 0)
              const x = getX(i) - (innerWidth / count) * 0.35
              const y = chartHeight - padding.bottom - barHeight
              const isHovered = hoverIndex === i
              return (
                <rect
                  key={`vol-${r.date}`}
                  x={x}
                  y={y}
                  width={Math.max((innerWidth / count) * 0.7, 2)}
                  height={barHeight}
                  className={`transition-colors ${
                    isHovered
                      ? 'fill-[var(--rasi-primary)]'
                      : 'fill-[var(--rasi-muted)]/40 hover:fill-[var(--rasi-muted)]/70'
                  }`}
                />
              )
            })}

            {/* Price Line Area */}
            <path
              d={`${pricePath} L ${getX(count - 1)} ${padding.top + innerHeight * 0.7} L ${getX(0)} ${padding.top + innerHeight * 0.7} Z`}
              fill={`url(#price-grad-${chartId})`}
            />

            {/* Price Line */}
            <path
              d={pricePath}
              fill="none"
              stroke="var(--rasi-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* SMA-20 Line */}
            {hasSma && smaPath && (
              <path
                d={smaPath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="4 2"
              />
            )}

            {/* Date axis markers */}
            {[0, Math.floor(count / 2), count - 1].map((idx) => {
              if (idx < 0 || idx >= count) return null
              const row = sortedRows[idx]
              return (
                <text
                  key={`date-${idx}`}
                  x={getX(idx)}
                  y={chartHeight - 12}
                  textAnchor={idx === 0 ? 'start' : idx === count - 1 ? 'end' : 'middle'}
                  className="fill-[var(--rasi-muted)] font-mono text-[10px]"
                >
                  {row.date}
                </text>
              )
            })}

            {/* Interactive hover overlay column */}
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

      {/* Accessible Historical Data Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--rasi-border)] px-5 py-4">
          <h4 className="text-sm font-bold text-[var(--rasi-text)]">
            Tabel Riwayat Harga, Volume, dan SMA-20
          </h4>
          <span className="text-xs text-[var(--rasi-muted)]">30 sesi terakhir</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Tabel data historis harga penutupan, volume transaksi, dan SMA-20 untuk {symbol}
            </caption>
            <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/50 font-semibold text-[var(--rasi-muted)]">
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
                const originalIndex = sortedRows.findIndex((r) => r.date === row.date)
                const sma = originalIndex >= 0 ? sma20Values[originalIndex] : null

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
                    <td className="px-4 py-2.5 text-right text-[var(--rasi-muted)]">
                      {formatCurrencyIdr(row.high)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--rasi-muted)]">
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
