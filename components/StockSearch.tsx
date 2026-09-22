'use client'

import React, { useEffect, useRef, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { ArrowRight, Filter, Loader2, Search, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui'
import { type StockSuggestion, searchLocalStocks } from '@/domain/stocks'
import { getSectorLabel } from '@/lib/presentation/stock'

const EXAMPLE_STOCKS = [
  { symbol: 'BBCA', name: 'Bank Central Asia Tbk.', sector: 'Financials' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia (Persero) Tbk.', sector: 'Financials' },
  { symbol: 'TLKM', name: 'Telkom Indonesia (Persero) Tbk.', sector: 'Telecommunication' },
]

export function StockSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQ)
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>(() =>
    searchLocalStocks(initialQ, 8),
  )
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'empty' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync query changes to URL without adding history stack clutter
  useEffect(() => {
    const url = new URL(window.location.href)
    if (query.trim()) {
      url.searchParams.set('q', query.trim())
    } else {
      url.searchParams.delete('q')
    }
    window.history.replaceState(null, '', url.toString())
  }, [query])

  // Instant local suggestions + debounced remote search with AbortController
  useEffect(() => {
    const trimmed = query.trim()

    // Immediately provide local instant suggestions (0ms delay)
    const local = searchLocalStocks(trimmed, 8)
    const localTimer = window.setTimeout(() => {
      if (local.length > 0) {
        setSuggestions(local)
        setStatus('found')
      }
      if (!trimmed) {
        setStatus('idle')
        setErrorMessage('')
      }
    }, 0)

    if (!trimmed) {
      if (activeRequestRef.current) activeRequestRef.current.abort()
      return () => window.clearTimeout(localTimer)
    }

    const currentRequestId = ++requestIdRef.current
    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }
    const controller = new AbortController()
    activeRequestRef.current = controller

    const timer = window.setTimeout(() => {
      setStatus('searching')
      setFocusedIndex(-1)

      void fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (currentRequestId !== requestIdRef.current) return
          const payload = (await res.json()) as {
            results?: StockSuggestion[]
            error?: string
          }

          if (!res.ok) {
            throw new Error(payload.error || 'Pencarian belum tersedia.')
          }

          const results = payload.results ?? []
          if (results.length > 0) {
            setSuggestions(results)
            setStatus('found')
          } else if (local.length === 0) {
            setSuggestions([])
            setStatus('empty')
          }
          setErrorMessage('')
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (currentRequestId !== requestIdRef.current) return
          if (local.length === 0) {
            setSuggestions([])
            setStatus('error')
            setErrorMessage(err instanceof Error ? err.message : 'Pencarian gagal.')
          }
        })
    }, 200)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const selectStock = (symbol: string) => {
    setIsOpen(false)
    router.push(`/saham/${encodeURIComponent(symbol)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        setIsOpen(true)
        setFocusedIndex(0)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && suggestions[focusedIndex]) {
        e.preventDefault()
        selectStock(suggestions[focusedIndex].symbol)
      } else {
        const potentialTicker = query.trim().toUpperCase().replace(/\.JK$/i, '')
        if (/^[A-Z]{4}$/.test(potentialTicker)) {
          e.preventDefault()
          selectStock(potentialTicker)
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setFocusedIndex(-1)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-8 sm:py-14">
      {/* Header section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-4xl">
          Saham apa yang ingin Anda pahami?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--rasi-muted)]">
          {' '}
          Ketik kode atau nama perusahaan untuk melihat harga, laporan keuangan, transaksi, dan
          berita.{' '}
        </p>
      </div>

      {/* Search form with WAI-ARIA Combobox pattern */}
      <div ref={containerRef} className="relative mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const potentialTicker = query.trim().toUpperCase().replace(/\.JK$/i, '')
            if (/^[A-Z]{4}$/.test(potentialTicker)) {
              selectStock(potentialTicker)
            }
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="stock-search-listbox"
              aria-activedescendant={
                focusedIndex >= 0 ? `search-option-${focusedIndex}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0 || status === 'empty' || !query.trim()) setIsOpen(true)
              }}
              placeholder="Cari kode atau nama perusahaan (contoh: TLKM, BBCA, atau Telkom)"
              className="min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-4 py-2 text-sm text-[var(--rasi-text)] transition-colors outline-none placeholder:text-[var(--rasi-muted)] focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]"
            />
          </div>
          <Button type="submit" variant="primary" size="md" icon={Search} disabled={!query.trim()}>
            Cari
          </Button>
        </form>

        {/* Combobox popup listbox */}
        {isOpen && (
          <div
            ref={listboxRef}
            id="stock-search-listbox"
            role="listbox"
            aria-label="Hasil pencarian saham"
            className="absolute top-full right-16 left-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-[var(--rasi-border)] px-4 py-2 text-[11px] font-semibold text-[var(--rasi-muted)]">
              <span className="flex items-center gap-1">
                {!query.trim() ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--rasi-primary)]" />
                    Rekomendasi Saham Populer
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5 text-[var(--rasi-primary)]" />
                    Saran Pencarian
                  </>
                )}
              </span>
              <span className="text-[10px] text-[var(--rasi-muted)]">Pilih atau tekan Enter</span>
            </div>

            {status === 'searching' && suggestions.length === 0 && (
              <div className="flex items-center gap-2 p-4 text-sm text-[var(--rasi-muted)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
                Mencari perusahaan…
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 text-sm text-rose-700 dark:text-rose-300">{errorMessage}</div>
            )}

            {status === 'empty' && (
              <div className="p-4 text-sm text-[var(--rasi-muted)]">
                Saham atau perusahaan tidak ditemukan. Coba periksa kembali ejaan nama atau kode
                saham.
              </div>
            )}

            {status === 'found' &&
              suggestions.map((item, index) => {
                const isFocused = focusedIndex === index
                return (
                  <div
                    key={item.symbol}
                    id={`search-option-${index}`}
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => selectStock(item.symbol)}
                    className={`cursor-pointer border-b border-[var(--rasi-border)] px-4 py-3 transition-colors last:border-0 ${
                      isFocused
                        ? 'bg-[var(--rasi-active-bg)] text-[var(--rasi-primary)]'
                        : 'text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-base font-bold">{item.symbol}</span>
                      <span className="text-xs text-[var(--rasi-muted)]">
                        {getSectorLabel(item.sector)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--rasi-muted)]">
                      {item.name}
                    </p>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Filter link */}
      <div className="mt-4 flex items-center justify-between px-1">
        <Link
          href="/screener"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Cari berdasarkan kriteria{' '}
        </Link>
        <span className="text-xs text-[var(--rasi-muted)]">Tekan Enter untuk membuka detail</span>
      </div>

      {/* Examples section */}
      <div className="mt-10 border-t border-[var(--rasi-border)] pt-8">
        <p className="text-xs font-semibold tracking-wider text-[var(--rasi-muted)] uppercase">
          Contoh saham untuk dipelajari (bukan rekomendasi)
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {EXAMPLE_STOCKS.map((example) => (
            <Link
              key={example.symbol}
              href={`/saham/${example.symbol}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-xl shadow-black/40 transition-all hover:border-[var(--rasi-primary)] focus-visible:outline-none"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold text-[var(--rasi-text)] group-hover:text-[var(--rasi-primary)]">
                    {example.symbol}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--rasi-muted)] opacity-0 transition-opacity group-hover:text-[var(--rasi-primary)] group-hover:opacity-100" />
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[var(--rasi-muted)]">{example.name}</p>
              </div>
              <span className="mt-3 text-[11px] font-medium text-[var(--rasi-muted)]">
                {getSectorLabel(example.sector)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
