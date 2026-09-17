'use client'

import { useState } from 'react'

import Link from 'next/link'

import { ArrowUpRight, GitCompareArrows, Loader2, X } from 'lucide-react'

import { analyzeTicker } from '@/app/actions'
import { ResearchShell } from '@/components/ResearchShell'
import type { Anomaly } from '@/db/schema'

export default function ComparePage() {
  const [symbols, setSymbols] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['BBCA', 'BBRI']
    const values = new URLSearchParams(window.location.search)
      .get('symbols')
      ?.split(',')
      .map((item) => item.trim().toUpperCase().replace(/\.JK$/i, ''))
      .filter((item) => /^[A-Z]{4}$/.test(item))
    return values?.length ? [...new Set(values)].slice(0, 3) : ['BBCA', 'BBRI']
  })
  const [input, setInput] = useState('')
  const [rows, setRows] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addSymbol = () => {
    const value = input.trim().toUpperCase().replace(/\.JK$/i, '')
    if (!/^[A-Z]{4}$/.test(value) || symbols.includes(value) || symbols.length >= 3) return
    setSymbols([...symbols, value])
    setInput('')
  }

  const remove = (symbol: string) => setSymbols(symbols.filter((item) => item !== symbol))

  const compare = async () => {
    setLoading(true)
    setError('')
    const results: Anomaly[] = []
    for (const symbol of symbols) {
      const result = await analyzeTicker(symbol)
      if (result.data) results.push(result.data)
      else if (result.error) setError(result.error)
    }
    setRows(results)
    setLoading(false)
    window.history.replaceState(null, '', '/bandingkan?symbols=' + symbols.join(','))
  }

  return (
    <ResearchShell>
      <section>
        <p className="text-sm font-semibold text-blue-600">Bandingkan saham</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Lihat perbedaan tanpa memaksa satu pemenang
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--rasi-muted)]">
          Nilai yang tidak tersedia tetap kosong. Periode data harus diperiksa sebelum menarik
          kesimpulan.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {symbols.map((symbol) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-2 font-mono text-sm font-bold"
            >
              {symbol}
              <button type="button" aria-label={'Hapus ' + symbol} onClick={() => remove(symbol)}>
                <X className="h-4 w-4 text-[var(--rasi-muted)] hover:text-rose-600" />
              </button>
            </span>
          ))}
          {symbols.length < 3 && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                addSymbol()
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-label="Tambah kode saham"
                placeholder="Tambah ticker"
                className="min-h-10 w-32 rounded-lg border border-[var(--rasi-border)] bg-transparent px-3 text-sm"
              />
              <button type="submit" className="rasi-button-secondary">
                Tambah
              </button>
            </form>
          )}
        </div>
        <button
          type="button"
          className="rasi-button-primary mt-5"
          disabled={loading || symbols.length < 2}
          onClick={() => void compare()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitCompareArrows className="h-4 w-4" />
          )}{' '}
          Muat perbandingan
        </button>
        {error && (
          <p
            className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
          {rows.length ? (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-[var(--rasi-muted-bg)]">
                <tr>
                  <th className="px-4 py-3">Metrik</th>
                  {rows.map((row) => (
                    <th key={row.ticker} className="px-4 py-3 font-mono">
                      {row.ticker}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Harga penutupan', (row: Anomaly) => row.price],
                  ['Perubahan', (row: Anomaly) => row.change],
                  ['Volume spike', (row: Anomaly) => row.volumeSpike],
                  [
                    'Indikator perhatian',
                    (row: Anomaly) => String(row.compositeScore ?? row.risk) + '/100',
                  ],
                  ['Status', (row: Anomaly) => row.status],
                ].map(([label, getter]) => (
                  <tr key={String(label)} className="border-t border-[var(--rasi-border)]">
                    <td className="px-4 py-3 font-medium text-[var(--rasi-muted)]">
                      {String(label)}
                    </td>
                    {rows.map((row) => (
                      <td key={row.ticker} className="px-4 py-3 tabular-nums">
                        {(getter as (value: Anomaly) => string)(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-[var(--rasi-border)]">
                  <td className="px-4 py-3">Detail</td>
                  {rows.map((row) => (
                    <td key={row.ticker} className="px-4 py-3">
                      <Link
                        href={'/saham/' + row.ticker}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Buka <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-[var(--rasi-muted)]">
              Tambahkan dua atau tiga saham, lalu muat perbandingan.
            </div>
          )}
        </div>
      </section>
    </ResearchShell>
  )
}
