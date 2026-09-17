'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Search } from 'lucide-react'

import { ResearchShell } from '@/components/ResearchShell'

export default function StocksPage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<
    Array<{ symbol: string; name: string; sector: string }>
  >([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const router = useRouter()
  const ticker = query.trim().toUpperCase().replace(/\.JK$/, '')

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      const timer = window.setTimeout(() => {
        setSuggestions([])
        setSearchError('')
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      void fetch('/api/stocks/search?q=' + encodeURIComponent(value), { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as {
            results?: Array<{ symbol: string; name: string; sector: string }>
            error?: string
          }
          if (!response.ok) throw new Error(payload.error || 'Pencarian belum tersedia.')
          setSuggestions(payload.results ?? [])
          setSearchError('')
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSuggestions([])
          setSearchError(error instanceof Error ? error.message : 'Pencarian gagal.')
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <ResearchShell>
      <section className="mx-auto max-w-3xl py-10">
        <p className="text-sm font-semibold text-blue-600">Cari saham</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Mulai dari perusahaan yang ingin Anda pahami
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--rasi-muted)]">
          Masukkan kode saham IDX, lalu baca ringkasan, grafik, fundamental, broker, berita, dan
          transaksi orang dalam dalam satu ruang.
        </p>
        <form
          className="relative mt-8 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (ticker) router.push('/saham/' + encodeURIComponent(ticker))
          }}
        >
          <label className="sr-only" htmlFor="stock-search">
            Kode saham
          </label>
          <input
            id="stock-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Contoh: BBCA atau TLKM"
            className="min-h-12 flex-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {(searching || suggestions.length > 0 || searchError) && (
            <div
              className="absolute top-full right-16 left-0 z-20 mt-2 overflow-hidden rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] shadow-lg"
              role="listbox"
            >
              {searching && <p className="p-4 text-sm text-[var(--rasi-muted)]">Mencari…</p>}
              {!searching && searchError && (
                <p className="p-4 text-sm text-rose-700">{searchError}</p>
              )}
              {!searching && !searchError && suggestions.length === 0 && (
                <p className="p-4 text-sm text-[var(--rasi-muted)]">Saham tidak ditemukan.</p>
              )}
              {!searching &&
                suggestions.map((item) => (
                  <Link
                    key={item.symbol}
                    href={`/saham/${item.symbol}`}
                    role="option"
                    className="block border-b border-[var(--rasi-border)] px-4 py-3 last:border-0 hover:bg-[var(--rasi-muted-bg)]"
                  >
                    <span className="font-mono font-semibold">{item.symbol}</span>
                    <span className="ml-2 text-sm">{item.name}</span>
                    <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                      {item.sector}
                    </span>
                  </Link>
                ))}
            </div>
          )}
          <button
            type="submit"
            disabled={!ticker}
            className="rasi-button-primary min-h-12 px-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> Cari
          </button>
        </form>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {['BBCA', 'BBRI', 'TLKM'].map((symbol) => (
            <Link
              key={symbol}
              href={`/saham/${symbol}`}
              className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 transition hover:border-blue-400"
            >
              <span className="font-mono text-lg font-bold">{symbol}</span>
              <span className="mt-1 block text-xs text-[var(--rasi-muted)]">Buka contoh riset</span>
            </Link>
          ))}
        </div>
      </section>
    </ResearchShell>
  )
}
