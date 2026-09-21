'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { ExternalLink, Plus, RefreshCw, X } from 'lucide-react'

import { getStockData } from '@/app/actions'
import { StockSearchCombobox } from '@/components/StockSearchCombobox'
import { Button, ButtonLink } from '@/components/ui'
import {
  formatCurrencyIdr,
  formatPercentageChange,
  formatScore,
  getStatusLabel,
} from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

interface StockColumnData {
  symbol: string
  data: StockDataResult | null
  loading: boolean
  error: string | null
}

function CompareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [symbols, setSymbols] = useState<string[]>(() => {
    const raw = searchParams.get('symbols')
    if (raw) {
      const parsed = raw
        .split(',')
        .map((s) => s.trim().toUpperCase().replace(/\.JK$/i, ''))
        .filter((s) => /^[A-Z]{4}$/.test(s))
      if (parsed.length >= 2) return [...new Set(parsed)].slice(0, 3)
    }
    return ['BBCA', 'BBRI']
  })

  const [inputTicker, setInputTicker] = useState('')
  const [columns, setColumns] = useState<StockColumnData[]>([])
  const [comparing, setComparing] = useState(false)

  // Fetch comparison data concurrently via getStockData (no Gemini, no DB write, no quota)
  const loadComparison = useCallback(async (stockSymbols: string[]) => {
    setComparing(true)

    // Set placeholder loading states
    setColumns(
      stockSymbols.map((s) => ({
        symbol: s,
        data: null,
        loading: true,
        error: null,
      })),
    )

    const results = await Promise.all(
      stockSymbols.map(async (symbol) => {
        try {
          const res = await getStockData(symbol)
          if (res.success && res.data) {
            return { symbol, data: res.data, loading: false, error: null }
          }
          return {
            symbol,
            data: null,
            loading: false,
            error: res.error || 'Data saham tidak ditemukan.',
          }
        } catch (err) {
          return {
            symbol,
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data.',
          }
        }
      }),
    )

    setColumns(results)
    setComparing(false)
  }, [])

  // Load comparison whenever symbols change
  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadComparison(symbols)
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [symbols, loadComparison])

  const addSymbol = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = inputTicker.trim().toUpperCase().replace(/\.JK$/i, '')
    if (!/^[A-Z]{4}$/.test(clean) || symbols.includes(clean) || symbols.length >= 3) return

    const next = [...symbols, clean]
    setSymbols(next)
    setInputTicker('')
    router.replace(`/bandingkan?symbols=${next.join(',')}`, { scroll: false })
  }

  const removeSymbol = (symbol: string) => {
    if (symbols.length <= 2) return // Keep minimum 2
    const next = symbols.filter((s) => s !== symbol)
    setSymbols(next)
    router.replace(`/bandingkan?symbols=${next.join(',')}`, { scroll: false })
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          Bandingkan Saham
        </h1>
        <p className="mt-1 text-sm text-[var(--rasi-muted)]">
          {' '}
          Lihat harga, laporan keuangan, dan transaksi dari 2–3 saham dalam satu tabel.{' '}
        </p>
      </div>

      {/* Symbol selection toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4">
        <span className="text-xs font-semibold text-[var(--rasi-muted)]">Saham terpilih:</span>

        <div className="flex flex-wrap items-center gap-2">
          {symbols.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/60 px-3 py-1.5 font-mono text-sm font-bold text-[var(--rasi-text)]"
            >
              {sym}
              {symbols.length > 2 && (
                <button
                  type="button"
                  aria-label={`Hapus ${sym}`}
                  onClick={() => removeSymbol(sym)}
                  className="text-[var(--rasi-muted)] hover:text-[var(--rasi-danger)] focus-visible:outline-none"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>

        {symbols.length < 3 && (
          <form onSubmit={addSymbol} className="flex items-center gap-2">
            <StockSearchCombobox
              value={inputTicker}
              onChange={(val) => setInputTicker(val.toUpperCase())}
              onSelect={(sym) => {
                const clean = sym.trim().toUpperCase().replace(/\.JK$/i, '')
                if (/^[A-Z]{4}$/.test(clean) && !symbols.includes(clean)) {
                  setSymbols((prev) => [...prev, clean])
                  setInputTicker('')
                }
              }}
              placeholder="Tambah kode (contoh: TLKM)"
              size="sm"
              className="w-52 sm:w-64"
              dropdownAlign="left"
              aria-label="Tambah kode saham untuk perbandingan"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              icon={Plus}
              disabled={!inputTicker.trim()}
            >
              Tambah
            </Button>
          </form>
        )}

        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={() => loadComparison(symbols)}
          pending={comparing}
          pendingText="Memperbarui…"
          className="ml-auto"
        >
          Segarkan data
        </Button>
      </div>

      {/* Comparison Table with Sticky Header & Sticky Row Label Column on Mobile */}
      <div className="overflow-hidden rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/50 text-[var(--rasi-muted)]">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-44 bg-[var(--rasi-muted-bg)]/90 px-4 py-3 font-semibold backdrop-blur-xs"
                >
                  {' '}
                  Data yang dibandingkan{' '}
                </th>
                {columns.map((col) => (
                  <th
                    key={col.symbol}
                    scope="col"
                    className="min-w-[200px] px-4 py-3 font-semibold"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-bold text-[var(--rasi-text)]">
                        {col.symbol}
                      </span>
                      <ButtonLink
                        href={`/saham/${col.symbol}`}
                        variant="ghost"
                        size="sm"
                        icon={ExternalLink}
                      >
                        Detail
                      </ButtonLink>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rasi-border)] text-[var(--rasi-text)]">
              {/* Nama Perusahaan */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  Perusahaan
                </th>
                {columns.map((col) => (
                  <td key={col.symbol} className="px-4 py-3 font-medium">
                    {col.loading ? (
                      <span className="animate-pulse text-[var(--rasi-muted)]">Memuat…</span>
                    ) : col.error ? (
                      <span className="text-rose-600 dark:text-rose-400">Gagal dimuat</span>
                    ) : (
                      col.data?.companyName
                    )}
                  </td>
                ))}
              </tr>

              {/* Harga Terakhir */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  Harga Penutupan
                </th>
                {columns.map((col) => {
                  if (col.loading)
                    return (
                      <td
                        key={col.symbol}
                        className="animate-pulse px-4 py-3 text-[var(--rasi-muted)]"
                      >
                        …
                      </td>
                    )
                  if (col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  return (
                    <td
                      key={col.symbol}
                      className="px-4 py-3 font-mono text-base font-bold tabular-nums"
                    >
                      {formatCurrencyIdr(col.data?.price)}
                    </td>
                  )
                })}
              </tr>

              {/* Perubahan Harga */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  Perubahan Harian
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  const { text, trend } = formatPercentageChange(col.data?.priceChangeFraction)
                  return (
                    <td
                      key={col.symbol}
                      className={`px-4 py-3 font-mono font-bold tabular-nums ${
                        trend === 'up'
                          ? 'text-[var(--rasi-success)]'
                          : trend === 'down'
                            ? 'text-[var(--rasi-danger)]'
                            : 'text-[var(--rasi-muted)]'
                      }`}
                    >
                      {text}
                    </td>
                  )
                })}
              </tr>

              {/* P/E Ratio */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  {' '}
                  Harga dibanding laba (P/E){' '}
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  const pe = col.data?.indicators.fundamental.pe
                  return (
                    <td key={col.symbol} className="px-4 py-3 font-mono tabular-nums">
                      {pe !== null && pe !== undefined ? `${pe.toFixed(1)}x` : 'Data belum cukup'}
                    </td>
                  )
                })}
              </tr>

              {/* P/B Ratio */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  {' '}
                  Harga dibanding aset bersih (P/B){' '}
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  const pb = col.data?.indicators.fundamental.pb
                  return (
                    <td key={col.symbol} className="px-4 py-3 font-mono tabular-nums">
                      {pb !== null && pb !== undefined ? `${pb.toFixed(1)}x` : 'Data belum cukup'}
                    </td>
                  )
                })}
              </tr>

              {/* Volume Spike */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  {' '}
                  Transaksi dibanding rata-rata 20 hari{' '}
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  return (
                    <td key={col.symbol} className="px-4 py-3 font-mono tabular-nums">
                      {col.data?.indicators.volume.formattedRatio}
                    </td>
                  )
                })}
              </tr>

              {/* Arus Broker */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  {' '}
                  Transaksi lewat broker{' '}
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  return (
                    <td key={col.symbol} className="px-4 py-3 font-semibold">
                      {getStatusLabel(col.data?.indicators.bandarmology.status).label}
                    </td>
                  )
                })}
              </tr>

              {/* Status Insider */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-medium text-[var(--rasi-muted)]"
                >
                  Transaksi pengurus dan pemegang saham besar
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  return (
                    <td key={col.symbol} className="px-4 py-3">
                      {getStatusLabel(col.data?.indicators.insider.status).label}
                    </td>
                  )
                })}
              </tr>

              {/* Skor Komposit */}
              <tr className="bg-[var(--rasi-muted-bg)]/20">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--rasi-surface)] px-4 py-3 font-bold text-[var(--rasi-text)]"
                >
                  {' '}
                  Skor RASI{' '}
                </th>
                {columns.map((col) => {
                  if (col.loading || col.error)
                    return (
                      <td key={col.symbol} className="px-4 py-3 text-[var(--rasi-muted)]">
                        —
                      </td>
                    )
                  return (
                    <td key={col.symbol} className="px-4 py-3 font-mono font-bold">
                      {formatScore(col.data?.composite.score)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--rasi-muted)]">
          Memuat halaman perbandingan…
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  )
}
