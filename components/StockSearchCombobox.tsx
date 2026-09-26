'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Loader2, Search, TrendingUp } from 'lucide-react'

import { type StockSuggestion, searchLocalStocks } from '@/domain/stocks'
import { getSectorLabel } from '@/lib/presentation/stock'

export interface StockSearchComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect: (symbol: string, item?: StockSuggestion) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  size?: 'sm' | 'md' | 'lg'
  autoFocus?: boolean
  showPopularOnFocus?: boolean
  dropdownAlign?: 'left' | 'right' | 'full'
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
}

export function StockSearchCombobox({
  value,
  onChange,
  onSelect,
  placeholder = 'Cari saham (contoh: TLKM, BBCA)…',
  className = '',
  inputClassName = '',
  size = 'md',
  autoFocus = false,
  showPopularOnFocus = true,
  dropdownAlign = 'full',
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel = 'Pencarian kode atau nama saham',
}: StockSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>(() =>
    showPopularOnFocus ? searchLocalStocks('', 6) : [],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  // Synchronize local suggestions immediately when query changes
  const updateSuggestions = useCallback((q: string) => {
    const trimmed = q.trim()
    const local = searchLocalStocks(trimmed, 8)
    setSuggestions(local)
    setFocusedIndex(-1)
  }, [])

  // Remote fetch with debounce
  useEffect(() => {
    const trimmed = value.trim()
    const localTimer = window.setTimeout(() => {
      updateSuggestions(trimmed)
      if (!trimmed) {
        setRemoteLoading(false)
      }
    }, 0)

    if (!trimmed) {
      if (activeRequestRef.current) activeRequestRef.current.abort()
      return () => window.clearTimeout(localTimer)
    }

    const currentRequestId = ++requestIdRef.current
    if (activeRequestRef.current) activeRequestRef.current.abort()

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRemoteLoading(true)
      void fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (currentRequestId !== requestIdRef.current) return
          if (!res.ok) throw new Error('Failed to fetch')
          const data = (await res.json()) as { results?: StockSuggestion[] }
          const results = data.results ?? []
          if (results.length > 0) {
            setSuggestions(results)
          }
        })
        .catch(() => {
          // Keep local suggestions if remote fails or aborts
        })
        .finally(() => {
          if (currentRequestId === requestIdRef.current) {
            setRemoteLoading(false)
          }
        })
    }, 200)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value, updateSuggestions])

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

  const handleSelect = (symbol: string, item?: StockSuggestion) => {
    onSelect(symbol, item)
    setIsOpen(false)
    setFocusedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
        setFocusedIndex(0)
        e.preventDefault()
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
        handleSelect(suggestions[focusedIndex].symbol, suggestions[focusedIndex])
      } else {
        const potentialTicker = value.trim().toUpperCase().replace(/\.JK$/i, '')
        if (/^[A-Z]{4}$/.test(potentialTicker)) {
          e.preventDefault()
          handleSelect(potentialTicker)
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setFocusedIndex(-1)
    }
  }

  // Size styles
  const sizeClasses = {
    sm: 'min-h-[36px] px-3 py-1.5 text-xs',
    md: 'min-h-[44px] px-3.5 py-2 text-sm',
    lg: 'min-h-[50px] px-4 py-2.5 text-base',
  }[size]

  // Dropdown alignment
  const alignClasses = {
    full: 'left-0 right-0',
    left: 'left-0 min-w-[280px]',
    right: 'right-0 min-w-[280px]',
  }[dropdownAlign]

  const isQueryEmpty = !value.trim()

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : 'stock-combobox-listbox'}
          aria-activedescendant={focusedIndex >= 0 ? `combobox-option-${focusedIndex}` : undefined}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (showPopularOnFocus || suggestions.length > 0) {
              setIsOpen(true)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] font-mono text-[var(--rasi-text)] uppercase transition-colors outline-none placeholder:font-sans placeholder:text-[var(--rasi-muted)]/70 placeholder:normal-case focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20 ${sizeClasses} ${inputClassName}`}
        />
        {remoteLoading && (
          <div className="pointer-events-none absolute right-3">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--rasi-primary)]" />
          </div>
        )}
      </div>

      {/* Suggestion Dropdown Listbox */}
      {isOpen && (
        <div
          id={id ? `${id}-listbox` : 'stock-combobox-listbox'}
          role="listbox"
          aria-label="Rekomendasi saham"
          className={`absolute top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] shadow-[var(--rasi-card-shadow)] ${alignClasses}`}
        >
          {/* Header indicator */}
          <div className="flex items-center justify-between border-b border-[var(--rasi-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--rasi-muted)]">
            <span className="flex items-center gap-1">
              {isQueryEmpty ? (
                <>
                  <TrendingUp className="h-3 w-3 text-[var(--rasi-primary)]" />
                  Rekomendasi Saham Populer
                </>
              ) : (
                <>
                  <Search className="h-3 w-3 text-[var(--rasi-primary)]" />
                  Saran Pencarian
                </>
              )}
            </span>
            <span className="text-[10px] text-[var(--rasi-muted)]">Pilih atau tekan Enter</span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--rasi-muted)]">
              Tidak ada saham yang cocok. Ketik 4 huruf kode saham IDX.
            </div>
          ) : (
            suggestions.map((item, idx) => {
              const isFocused = focusedIndex === idx
              return (
                <div
                  key={item.symbol}
                  id={`combobox-option-${idx}`}
                  role="option"
                  aria-selected={isFocused}
                  onClick={() => handleSelect(item.symbol, item)}
                  className={`flex cursor-pointer items-center justify-between border-b border-[var(--rasi-border)] px-3 py-2.5 transition-colors last:border-0 ${
                    isFocused
                      ? 'bg-[var(--rasi-active-bg)] text-[var(--rasi-primary)]'
                      : 'text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-tight text-[var(--rasi-text)]">
                        {item.symbol}
                      </span>
                      <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--rasi-muted)]">
                        {getSectorLabel(item.sector)}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-[var(--rasi-muted)]">{item.name}</p>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="shrink-0 rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--rasi-text)] hover:border-[var(--rasi-primary)] focus:outline-none"
                  >
                    Pilih
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
