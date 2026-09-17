'use client'

import { useState } from 'react'

import Link from 'next/link'

import { ArrowUpRight, Filter, Loader2, RotateCcw, Search, Star } from 'lucide-react'

import { type ScreenerResult, runScreener } from '@/app/actions'
import { ResearchShell } from '@/components/ResearchShell'

const presets = [
  { id: 'large', label: 'Perusahaan besar', minMarketCap: '10' },
  { id: 'value', label: 'P/E maksimal 15', maxPe: '15' },
  { id: 'dividend', label: 'Membagikan dividen', minYield: '0' },
  { id: 'growth', label: 'Laba bertumbuh', minEarningsGrowth: '0' },
  { id: 'valuation', label: 'Valuasi tertentu', maxPe: '15', maxPb: '2' },
]

export default function ScreenerPage() {
  const [query, setQuery] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('q') ?? ''),
  )
  const [sector, setSector] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('sector') ?? ''),
  )
  const [maxPe, setMaxPe] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('pe') ?? ''),
  )
  const [maxPb, setMaxPb] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('pb') ?? ''),
  )
  const [minMarketCap, setMinMarketCap] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('mcap') ?? ''),
  )
  const [minYield, setMinYield] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('yield') ?? ''),
  )
  const [minEarningsGrowth, setMinEarningsGrowth] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('growth') ?? ''),
  )
  const [rows, setRows] = useState<ScreenerResult[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const apply = async (
    nextOffset = offset,
    override?: Partial<{
      query: string
      sector: string
      maxPe: string
      maxPb: string
      minMarketCap: string
      minYield: string
      minEarningsGrowth: string
    }>,
  ) => {
    const currentQuery = override?.query ?? query
    const currentSector = override?.sector ?? sector
    const currentMaxPe = override?.maxPe ?? maxPe
    const currentMaxPb = override?.maxPb ?? maxPb
    const currentMinMarketCap = override?.minMarketCap ?? minMarketCap
    const currentMinYield = override?.minYield ?? minYield
    const currentMinEarningsGrowth = override?.minEarningsGrowth ?? minEarningsGrowth
    setLoading(true)
    setError('')
    const result = await runScreener({
      query: currentQuery,
      sector: currentSector,
      maxPe: currentMaxPe,
      maxPb: currentMaxPb,
      minMarketCap: currentMinMarketCap,
      minYield: currentMinYield,
      minEarningsGrowth: currentMinEarningsGrowth,
      offset: nextOffset,
    })
    if (result.error) setError(result.error)
    setRows(result.data ?? [])
    setTotal(result.total ?? 0)
    setOffset(nextOffset)
    setLoading(false)
    const params = new URLSearchParams()
    if (currentQuery) params.set('q', currentQuery)
    if (currentSector) params.set('sector', currentSector)
    if (currentMaxPe) params.set('pe', currentMaxPe)
    if (currentMaxPb) params.set('pb', currentMaxPb)
    if (currentMinMarketCap) params.set('mcap', currentMinMarketCap)
    if (currentMinYield) params.set('yield', currentMinYield)
    if (currentMinEarningsGrowth) params.set('growth', currentMinEarningsGrowth)
    window.history.replaceState(null, '', '/screener' + (params.size ? '?' + params : ''))
  }

  const applyPreset = (preset: (typeof presets)[number]) => {
    setMaxPe(preset.maxPe ?? '')
    setMaxPb(preset.maxPb ?? '')
    setMinMarketCap(preset.minMarketCap ?? '')
    setMinYield(preset.minYield ?? '')
    setMinEarningsGrowth(preset.minEarningsGrowth ?? '')
    void apply(0, {
      maxPe: preset.maxPe ?? '',
      maxPb: preset.maxPb ?? '',
      minMarketCap: preset.minMarketCap ?? '',
      minYield: preset.minYield ?? '',
      minEarningsGrowth: preset.minEarningsGrowth ?? '',
    })
  }

  return (
    <ResearchShell>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">Penyaring saham</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Cari kandidat berdasarkan data yang bisa diperiksa
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--rasi-muted)]">
              Hasil berasal dari screener Sectors. Preset adalah titik awal riset, bukan jaminan
              kualitas saham.
            </p>
          </div>
          <span className="rounded-full bg-[var(--rasi-muted-bg)] px-3 py-1 text-xs text-[var(--rasi-muted)]">
            Maksimal 25 hasil per halaman
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rasi-button-secondary"
            >
              <Star className="h-3.5 w-3.5 text-amber-500" /> {preset.label}
            </button>
          ))}
        </div>
        <form
          className="mt-5 grid gap-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault()
            void apply(0)
          }}
        >
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold">Pertanyaan bahasa biasa</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="contoh: top 10 bank by market cap"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">Sektor</span>
            <input
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              placeholder="Financials"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">P/E maksimal</span>
            <input
              inputMode="decimal"
              value={maxPe}
              onChange={(event) => setMaxPe(event.target.value)}
              placeholder="15"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">P/B maksimal</span>
            <input
              inputMode="decimal"
              value={maxPb}
              onChange={(event) => setMaxPb(event.target.value)}
              placeholder="2"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">Kapitalisasi min (T)</span>
            <input
              inputMode="decimal"
              value={minMarketCap}
              onChange={(event) => setMinMarketCap(event.target.value)}
              placeholder="10"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">Dividend yield min</span>
            <input
              inputMode="decimal"
              value={minYield}
              onChange={(event) => setMinYield(event.target.value)}
              placeholder="0"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold">Pertumbuhan laba min</span>
            <input
              inputMode="decimal"
              value={minEarningsGrowth}
              onChange={(event) => setMinEarningsGrowth(event.target.value)}
              placeholder="0"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="rasi-button-primary" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Filter className="h-4 w-4" />
              )}{' '}
              Terapkan filter
            </button>
            <button
              type="button"
              className="rasi-button-secondary"
              onClick={() => {
                setQuery('')
                setSector('')
                setMaxPe('')
                setMaxPb('')
                setMinMarketCap('')
                setMinYield('')
                setMinEarningsGrowth('')
                setRows([])
                setError('')
                setOffset(0)
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </form>
        {error && (
          <div
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rasi-border)] px-4 py-3">
            <p className="text-sm font-semibold">
              {rows.length
                ? total.toLocaleString('id-ID') + ' perusahaan ditemukan'
                : 'Belum ada hasil'}
            </p>
            <p className="text-xs text-[var(--rasi-muted)]">Data dan tanggal mengikuti provider</p>
          </div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--rasi-muted-bg)] text-xs text-[var(--rasi-muted)]">
                  <tr>
                    <th className="px-4 py-3">Saham</th>
                    <th className="px-4 py-3">Sektor</th>
                    <th className="px-4 py-3">Harga</th>
                    <th className="px-4 py-3">P/E TTM</th>
                    <th className="px-4 py-3">P/B MRQ</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const symbol = row.symbol.replace(/\\.JK$/i, '')
                    return (
                      <tr key={row.symbol} className="border-t border-[var(--rasi-border)]">
                        <td className="px-4 py-3">
                          <Link
                            href={'/saham/' + symbol}
                            className="font-mono font-bold text-blue-600 hover:underline"
                          >
                            {symbol}
                          </Link>
                          <span className="mt-1 block max-w-[220px] truncate text-xs text-[var(--rasi-muted)]">
                            {row.company_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--rasi-muted)]">
                          {row.sector ?? row.sub_sector ?? 'Belum tersedia'}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.last_close_price
                            ? 'Rp ' + row.last_close_price.toLocaleString('id-ID')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.pe_ttm ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums">{row.pb_mrq ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={'/saham/' + symbol}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Buka <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--rasi-muted)]" />
              <p className="mt-3 text-sm font-semibold">Terapkan filter untuk melihat hasil</p>
              <p className="mt-1 text-sm text-[var(--rasi-muted)]">
                Jika provider gagal, RASI akan menjelaskan penyebabnya.
              </p>
            </div>
          )}
          {rows.length > 0 && (
            <div className="flex justify-end gap-2 border-t border-[var(--rasi-border)] p-3">
              <button
                type="button"
                className="rasi-button-secondary"
                disabled={!offset || loading}
                onClick={() => void apply(Math.max(0, offset - 25))}
              >
                Sebelumnya
              </button>
              <button
                type="button"
                className="rasi-button-secondary"
                disabled={loading || offset + rows.length >= total}
                onClick={() => void apply(offset + 25)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </div>
      </section>
    </ResearchShell>
  )
}
