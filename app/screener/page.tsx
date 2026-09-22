'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import {
  type ScreenerResult,
  deleteSavedScreenAction,
  getSavedScreensAction,
  runScreener,
  saveScreenAction,
} from '@/app/actions'
import { ScreenerFilterDialog, type ScreenerFilters } from '@/components/ScreenerFilterDialog'
import { StockPreviewDialog } from '@/components/StockPreviewDialog'
import { Button, Dialog } from '@/components/ui'
import { MANDATORY_SCREENER_PRESETS, generateSafeCsv } from '@/domain/screener-presets'
import { getSectorLabel } from '@/lib/presentation/stock'

function ScreenerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<ScreenerFilters>(() => ({
    sector: searchParams.get('sector') ?? '',
    maxPe: searchParams.get('pe') ?? '',
    maxPb: searchParams.get('pb') ?? '',
    minMarketCap: searchParams.get('mcap') ?? '',
    minYield: searchParams.get('yield') ?? '',
    minEarningsGrowth: searchParams.get('growth') ?? '',
  }))

  const [nlpQuery, setNlpQuery] = useState(() => searchParams.get('q') ?? '')
  const [nlpInput, setNlpInput] = useState(() => searchParams.get('q') ?? '')

  const [rows, setRows] = useState<ScreenerResult[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(() => {
    const p = parseInt(searchParams.get('offset') ?? '0', 10)
    return isNaN(p) || p < 0 ? 0 : p
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dialog states
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [previewTicker, setPreviewTicker] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Saved screens state
  const [savedScreens, setSavedScreens] = useState<
    Array<{ id: number; title: string; filters: Record<string, unknown> }>
  >([])

  const loadSavedScreens = useCallback(async () => {
    const res = await getSavedScreensAction()
    if (res.success && res.data) {
      setSavedScreens(res.data as unknown as typeof savedScreens)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadSavedScreens()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadSavedScreens])

  const executeSearch = useCallback(
    async (currentFilters: ScreenerFilters, currentNlpQuery: string, currentOffset = 0) => {
      setLoading(true)
      setError('')

      try {
        const res = await runScreener({
          query: currentNlpQuery,
          sector: currentFilters.sector,
          maxPe: currentFilters.maxPe,
          maxPb: currentFilters.maxPb,
          minMarketCap: currentFilters.minMarketCap,
          minYield: currentFilters.minYield,
          minEarningsGrowth: currentFilters.minEarningsGrowth,
          offset: currentOffset,
        })

        if (res.error) {
          setError(res.error)
        } else {
          setRows(res.data ?? [])
          setTotal(res.total ?? 0)
          setOffset(currentOffset)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Penyaring gagal memuat data.')
      } finally {
        setLoading(false)
      }

      // Sync to URL
      const params = new URLSearchParams()
      if (currentNlpQuery) params.set('q', currentNlpQuery)
      if (currentFilters.sector) params.set('sector', currentFilters.sector)
      if (currentFilters.maxPe) params.set('pe', currentFilters.maxPe)
      if (currentFilters.maxPb) params.set('pb', currentFilters.maxPb)
      if (currentFilters.minMarketCap) params.set('mcap', currentFilters.minMarketCap)
      if (currentFilters.minYield) params.set('yield', currentFilters.minYield)
      if (currentFilters.minEarningsGrowth) params.set('growth', currentFilters.minEarningsGrowth)
      if (currentOffset > 0) params.set('offset', String(currentOffset))

      const queryString = params.toString()
      router.replace(queryString ? `/screener?${queryString}` : '/screener', { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void executeSearch(filters, nlpQuery, offset)
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply filters from modal
  const handleApplyFilters = (draft: ScreenerFilters) => {
    setFilters(draft)
    setNlpQuery('')
    setNlpInput('')
    executeSearch(draft, '', 0)
  }

  // Apply preset
  const handleApplyPreset = (presetFilters: Partial<ScreenerFilters>) => {
    const next: ScreenerFilters = {
      sector: '',
      maxPe: '',
      maxPb: '',
      minMarketCap: '',
      minYield: '',
      minEarningsGrowth: '',
      ...presetFilters,
    }
    setFilters(next)
    setNlpQuery('')
    setNlpInput('')
    executeSearch(next, '', 0)
  }

  // Save current screen
  const handleSaveScreen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saveTitle.trim()) return
    setSaveLoading(true)
    setSaveMessage('')

    const res = await saveScreenAction(
      saveTitle.trim(),
      filters as unknown as Record<string, unknown>,
    )
    setSaveLoading(false)

    if (res.success) {
      setSaveMessage('Preset berhasil disimpan.')
      setSaveTitle('')
      setSaveModalOpen(false)
      void loadSavedScreens()
    } else {
      setSaveMessage(res.error ?? 'Gagal menyimpan preset.')
    }
  }

  // Delete saved screen
  const handleDeleteScreen = async (id: number) => {
    const res = await deleteSavedScreenAction(id)
    if (res.success) {
      setSavedScreens((prev) => prev.filter((s) => s.id !== id))
    }
  }

  // Safe CSV export with formula injection protection
  const handleExportCsv = () => {
    if (rows.length === 0) return
    const columns = [
      { key: 'symbol' as const, header: 'Kode Saham' },
      { key: 'company_name' as const, header: 'Nama Perusahaan' },
      { key: 'sector' as const, header: 'Sektor' },
      { key: 'sub_sector' as const, header: 'Sub Sektor' },
      { key: 'last_close_price' as const, header: 'Harga Terakhir' },
      { key: 'market_cap' as const, header: 'Kapitalisasi Pasar' },
      { key: 'pe_ttm' as const, header: 'P/E (TTM)' },
      { key: 'pb_mrq' as const, header: 'P/B (MRQ)' },
      { key: 'roe_ttm' as const, header: 'ROE (TTM)' },
      { key: 'dividend_yield' as const, header: 'Dividen Yield' },
      { key: 'yoy_quarter_earnings_growth' as const, header: 'Pertumbuhan Laba YoY' },
    ]

    const csvData = generateSafeCsv(columns, rows as unknown as Array<Record<string, unknown>>)
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `screener-rasi-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Remove single filter chip
  const handleRemoveFilter = (key: keyof ScreenerFilters) => {
    const next = { ...filters, [key]: '' }
    setFilters(next)
    executeSearch(next, nlpQuery, 0)
  }

  // Reset all filters
  const handleResetAll = () => {
    const empty: ScreenerFilters = {
      sector: '',
      maxPe: '',
      maxPb: '',
      minMarketCap: '',
      minYield: '',
      minEarningsGrowth: '',
    }
    setFilters(empty)
    setNlpQuery('')
    setNlpInput('')
    executeSearch(empty, '', 0)
  }

  // Submit NLP query
  const handleNlpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setNlpQuery(nlpInput.trim())
    executeSearch(filters, nlpInput.trim(), 0)
  }

  // Active filter chips list
  const activeChips: Array<{ key: keyof ScreenerFilters; label: string }> = []
  if (filters.sector)
    activeChips.push({ key: 'sector', label: `Sektor: ${getSectorLabel(filters.sector)}` })
  if (filters.maxPe) activeChips.push({ key: 'maxPe', label: `Maks P/E: ${filters.maxPe}` })
  if (filters.maxPb) activeChips.push({ key: 'maxPb', label: `Maks P/B: ${filters.maxPb}` })
  if (filters.minMarketCap)
    activeChips.push({ key: 'minMarketCap', label: `Min Cap: ${filters.minMarketCap}T` })
  if (filters.minYield)
    activeChips.push({ key: 'minYield', label: `Min Dividen: ${filters.minYield}%` })
  if (filters.minEarningsGrowth)
    activeChips.push({ key: 'minEarningsGrowth', label: `Min Laba: ${filters.minEarningsGrowth}%` })

  const pageSize = 25
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          {' '}
          Cari saham sesuai kriteria{' '}
        </h1>
        <p className="mt-1 text-sm text-[var(--rasi-muted)]">
          {' '}
          Cari saham berdasarkan harga dibanding laba, dividen, ukuran perusahaan, atau bidang
          usaha.{' '}
        </p>
      </div>

      {/* Toolbar: Filter Button, Presets, and Active Chips */}
      <div className="relative space-y-3 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] p-5 shadow-xl shadow-black/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              icon={Filter}
              onClick={() => setFilterModalOpen(true)}
            >
              {' '}
              Atur kriteria {activeChips.length > 0 ? `(${activeChips.length})` : ''}
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={Bookmark}
              onClick={() => setSaveModalOpen(true)}
            >
              Simpan Kriteria
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={Download}
              onClick={handleExportCsv}
              disabled={rows.length === 0}
            >
              Ekspor CSV
            </Button>

            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]"
              >
                <RotateCcw className="h-3 w-3" /> Hapus kriteria{' '}
              </button>
            )}
          </div>

          <span className="font-mono text-xs text-[var(--rasi-muted)] tabular-nums">
            {total} saham ditemukan{' '}
          </span>
        </div>

        {/* Preset quick buttons */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-[var(--rasi-muted)]">
              {' '}
              Preset Riset:{' '}
            </span>
            {MANDATORY_SCREENER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.description}
                onClick={() => handleApplyPreset(p.filters)}
                className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--rasi-text)] transition-colors hover:border-[var(--rasi-primary)] hover:text-[var(--rasi-primary)]"
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* User's saved presets */}
          {savedScreens.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 text-xs font-medium text-[var(--rasi-muted)]">
                {' '}
                Preset Anda:{' '}
              </span>
              {savedScreens.map((s) => (
                <div
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--rasi-primary)]/40 bg-[var(--rasi-primary)]/10 px-2 py-0.5 text-xs text-[var(--rasi-primary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(s.filters)}
                    className="font-medium hover:underline"
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus preset ${s.title}`}
                    onClick={() => handleDeleteScreen(s.id)}
                    className="text-[var(--rasi-muted)] hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rasi-border)] pt-2">
            <span className="text-xs font-semibold text-[var(--rasi-muted)]">
              {' '}
              Kriteria dipakai:{' '}
            </span>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rasi-border)] bg-[var(--rasi-active-bg)] px-3 py-1 text-xs font-semibold text-[var(--rasi-primary)]"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Hapus ${chip.label}`}
                  onClick={() => handleRemoveFilter(chip.key)}
                  className="hover:opacity-75 focus-visible:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* NLP Disclosure: "Cari dengan kalimat" (does not send while typing) */}
      <details className="group rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4 text-sm text-[var(--rasi-muted)]">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)]">
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[var(--rasi-primary)]" /> Tulis saham yang Anda
            cari{' '}
          </span>
          <span className="text-xs transition-transform group-open:rotate-180">▾</span>
        </summary>
        <form onSubmit={handleNlpSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            placeholder="Contoh: Saham bank dengan dividen di atas 3% dan P/E di bawah 15"
            className="min-h-[44px] flex-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
          />
          <Button type="submit" variant="primary" size="md">
            Cari
          </Button>
        </form>
      </details>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-main)] via-[var(--surface-card)] to-[var(--bg-main)] shadow-2xl shadow-black/40">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center p-12 text-sm text-[var(--rasi-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--rasi-primary)]" /> Mencari
            saham…{' '}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--rasi-muted)]">
            {' '}
            Belum ada saham yang cocok. Coba ubah atau hapus sebagian kriteria.{' '}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] font-semibold text-[var(--rasi-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Kode
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Nama Perusahaan
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Sektor
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Harga
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    P/E
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    P/B
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {' '}
                    Dividen (%){' '}
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rasi-border)] text-[var(--rasi-text)]">
                {rows.map((row) => (
                  <tr
                    key={row.symbol}
                    className="transition-colors hover:bg-[var(--rasi-muted-bg)]/30"
                  >
                    <td className="px-4 py-3 font-mono font-bold">
                      <Link
                        href={`/saham/${row.symbol}`}
                        className="text-[var(--rasi-primary)] hover:underline focus-visible:outline-none"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">{row.company_name}</td>
                    <td className="px-4 py-3 text-[var(--rasi-muted)]">
                      {row.sector ?? row.sub_sector ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {typeof row.last_close_price === 'number'
                        ? `Rp ${row.last_close_price.toLocaleString('id-ID')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {typeof row.pe_ttm === 'number' ? `${row.pe_ttm.toFixed(1)}x` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {typeof row.pb_mrq === 'number' ? `${row.pb_mrq.toFixed(1)}x` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {typeof (row.dividend_yield ?? row.yield_ttm) === 'number'
                        ? `${((row.dividend_yield ?? row.yield_ttm)! * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => {
                          setPreviewTicker(row.symbol)
                          setPreviewOpen(true)
                        }}
                      >
                        Ringkasan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && total > pageSize && (
          <div className="flex items-center justify-between border-t border-[var(--rasi-border)] px-4 py-3 text-xs">
            <span className="text-[var(--rasi-muted)]">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={offset === 0}
                onClick={() => executeSearch(filters, nlpQuery, Math.max(0, offset - pageSize))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                iconPosition="right"
                disabled={offset + pageSize >= total}
                onClick={() => executeSearch(filters, nlpQuery, offset + pageSize)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ScreenerFilterDialog
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
      />

      <StockPreviewDialog
        ticker={previewTicker}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <Dialog
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Simpan Kriteria Screener"
        description="Simpan kombinasi kriteria saat ini untuk digunakan kembali kapan saja."
        role="form"
      >
        <form onSubmit={handleSaveScreen} className="space-y-4">
          <div>
            <label
              htmlFor="save-title"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Nama Kriteria
            </label>
            <input
              id="save-title"
              type="text"
              required
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Contoh: Saham Dividen Murah Q1"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>

          {saveMessage && (
            <p
              className={`text-xs ${saveMessage.includes('berhasil') ? 'text-emerald-500' : 'text-rose-500'}`}
            >
              {saveMessage}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setSaveModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saveLoading || !saveTitle.trim()}
            >
              {saveLoading ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

export default function ScreenerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--rasi-muted)]">
          Memuat penyaring saham…
        </div>
      }
    >
      <ScreenerContent />
    </Suspense>
  )
}
