'use client'

import { useState } from 'react'

import { Button, Dialog } from '@/components/ui'

export interface ScreenerFilters {
  sector: string
  maxPe: string
  maxPb: string
  minMarketCap: string
  minYield: string
  minEarningsGrowth: string
}

export interface ScreenerFilterDialogProps {
  open: boolean
  onClose: () => void
  filters: ScreenerFilters
  onApply: (draft: ScreenerFilters) => void
}

const SECTOR_OPTIONS = [
  'Financials',
  'Energy',
  'Basic Materials',
  'Industrials',
  'Consumer Non-Cyclicals',
  'Consumer Cyclicals',
  'Healthcare',
  'Technology',
  'Telecommunication',
  'Utilities',
  'Real Estate',
  'Transportation & Logistics',
]

export function ScreenerFilterDialog({
  open,
  onClose,
  filters,
  onApply,
}: ScreenerFilterDialogProps) {
  const [prevOpen, setPrevOpen] = useState(open)
  const [draft, setDraft] = useState<ScreenerFilters>(filters)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setDraft(filters)
    }
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    onApply(draft)
    onClose()
  }

  const handleReset = () => {
    setDraft({
      sector: '',
      maxPe: '',
      maxPb: '',
      minMarketCap: '',
      minYield: '',
      minEarningsGrowth: '',
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filter Lanjutan Saham"
      description="Atur kriteria rasio fundamental dan sektor untuk menyaring saham IDX."
      role="form"
    >
      <form onSubmit={handleApply} className="space-y-4">
        {/* Sektor */}
        <div>
          <label
            htmlFor="filter-sector"
            className="block text-xs font-semibold text-[var(--rasi-muted)]"
          >
            Sektor Industri
          </label>
          <select
            id="filter-sector"
            value={draft.sector}
            onChange={(e) => setDraft({ ...draft, sector: e.target.value })}
            className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
          >
            <option value="">Semua sektor</option>
            {SECTOR_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Rasio Valuasi */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="filter-pe"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Maksimal P/E
            </label>
            <input
              id="filter-pe"
              type="number"
              step="any"
              value={draft.maxPe}
              onChange={(e) => setDraft({ ...draft, maxPe: e.target.value })}
              placeholder="Contoh: 15"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] tabular-nums outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>
          <div>
            <label
              htmlFor="filter-pb"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Maksimal P/B
            </label>
            <input
              id="filter-pb"
              type="number"
              step="any"
              value={draft.maxPb}
              onChange={(e) => setDraft({ ...draft, maxPb: e.target.value })}
              placeholder="Contoh: 2"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] tabular-nums outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>
        </div>

        {/* Kapitalisasi Pasar & Dividen */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="filter-mcap"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Kapitalisasi Min (Triliun Rp)
            </label>
            <input
              id="filter-mcap"
              type="number"
              step="any"
              value={draft.minMarketCap}
              onChange={(e) => setDraft({ ...draft, minMarketCap: e.target.value })}
              placeholder="Contoh: 10"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] tabular-nums outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>
          <div>
            <label
              htmlFor="filter-yield"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Dividend Yield Min (%)
            </label>
            <input
              id="filter-yield"
              type="number"
              step="any"
              value={draft.minYield}
              onChange={(e) => setDraft({ ...draft, minYield: e.target.value })}
              placeholder="Contoh: 3"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] tabular-nums outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>
        </div>

        {/* Pertumbuhan Laba */}
        <div>
          <label
            htmlFor="filter-growth"
            className="block text-xs font-semibold text-[var(--rasi-muted)]"
          >
            Pertumbuhan Laba Min (%)
          </label>
          <input
            id="filter-growth"
            type="number"
            step="any"
            value={draft.minEarningsGrowth}
            onChange={(e) => setDraft({ ...draft, minEarningsGrowth: e.target.value })}
            placeholder="Contoh: 5"
            className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 font-mono text-sm text-[var(--rasi-text)] tabular-nums outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
          />
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-between border-t border-[var(--rasi-border)] pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-[var(--rasi-muted)] underline hover:text-[var(--rasi-text)]"
          >
            Reset filter
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="md">
              Terapkan filter
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
