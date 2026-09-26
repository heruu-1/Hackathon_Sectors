'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import {
  Layers,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { getMarketOverviewAction } from '@/app/actions'
import { Button } from '@/components/ui'
import type { MarketOverviewData } from '@/domain/market-overview'

export interface MarketOverviewProps {
  initialData?: MarketOverviewData
}

export function MarketOverview({ initialData }: MarketOverviewProps = {}) {
  const [data, setData] = useState<MarketOverviewData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await getMarketOverviewAction({ forceRefresh })
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Gagal memuat ringkasan pasar.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (initialData) return
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadData()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [initialData])

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-6 shadow-[var(--rasi-card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--rasi-border)] pb-4">
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--rasi-border)]" />
          <div className="h-8 w-24 animate-pulse rounded bg-[var(--rasi-border)]" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--rasi-border)]/50" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-[var(--rasi-border)]/50" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-6 text-center shadow-[var(--rasi-card-shadow)]">
        <p className="text-sm text-[var(--rasi-danger)]">{error || 'Data pasar belum tersedia.'}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => loadData(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
        </Button>
      </div>
    )
  }

  const { breadth, sectors, topGainers, topLosers, monitoredCoverage } = data

  const displayedSectors = selectedSector
    ? sectors.filter((s) => s.sector === selectedSector)
    : sectors

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)]">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--rasi-primary)]" />
            <h2 className="text-lg font-bold text-[var(--rasi-text)]">Peta Pasar & Sektor</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            Cutoff Data:{' '}
            <span className="font-semibold text-[var(--rasi-text)]">{breadth.cutoffDate}</span> •
            Cakupan: {monitoredCoverage.withPrice} emiten terpantau (
            {monitoredCoverage.percentCovered}%)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedSector && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedSector(null)}>
              Semua Sektor
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={() => loadData(true)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Perbarui
          </Button>
        </div>
      </div>

      {/* Market Breadth Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-4 shadow-[var(--rasi-card-shadow)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--rasi-muted)]">Saham Naik</span>
            <TrendingUp className="h-4 w-4 text-[var(--rasi-success)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--rasi-success)]">{breadth.advancing}</p>
          <span className="text-[11px] text-[var(--rasi-muted)]">
            {breadth.totalMonitored > 0
              ? ((breadth.advancing / breadth.totalMonitored) * 100).toFixed(0)
              : 0}
            % dari terpantau
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-4 shadow-[var(--rasi-card-shadow)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--rasi-muted)]">Saham Turun</span>
            <TrendingDown className="h-4 w-4 text-[var(--rasi-danger)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--rasi-danger)]">{breadth.declining}</p>
          <span className="text-[11px] text-[var(--rasi-muted)]">
            {breadth.totalMonitored > 0
              ? ((breadth.declining / breadth.totalMonitored) * 100).toFixed(0)
              : 0}
            % dari terpantau
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-4 shadow-[var(--rasi-card-shadow)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--rasi-muted)]">Tidak Berubah</span>
            <Minus className="h-4 w-4 text-[var(--rasi-muted)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--rasi-text)]">{breadth.unchanged}</p>
          <span className="text-[11px] text-[var(--rasi-muted)]">Harga stagnan</span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-4 shadow-[var(--rasi-card-shadow)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--rasi-muted)]">Median Pasar</span>
            <Layers className="h-4 w-4 text-[var(--rasi-primary)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--rasi-text)]">
            {breadth.medianMarketChange !== null
              ? `${(breadth.medianMarketChange * 100).toFixed(2)}%`
              : '0.00%'}
          </p>
          <span className="text-[11px] text-[var(--rasi-muted)]">Perubahan tengah pasar</span>
        </div>
      </div>

      {/* Sector Heatmap / Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--rasi-text)]">Distribusi Per Sektor</h3>
          <span className="text-xs text-[var(--rasi-muted)]">Klik sektor untuk menyaring</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSectors.map((sec) => {
            const isPositive = (sec.medianChangeFraction ?? 0) > 0
            const isNegative = (sec.medianChangeFraction ?? 0) < 0

            return (
              <div
                key={sec.sector}
                onClick={() => setSelectedSector(selectedSector === sec.sector ? null : sec.sector)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedSector === sec.sector
                    ? 'border-[var(--rasi-accent)] bg-[var(--rasi-surface-2)] ring-1 ring-[var(--rasi-accent)] shadow-[var(--rasi-card-shadow)]'
                    : 'border-[var(--rasi-border)] bg-[var(--rasi-card)] hover:border-[var(--rasi-border-hover)] hover:shadow-xs shadow-[var(--rasi-card-shadow)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--rasi-text)]">{sec.sector}</h4>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      isPositive
                        ? 'bg-[var(--rasi-success)]/15 text-[var(--rasi-success)]'
                        : isNegative
                          ? 'bg-[var(--rasi-danger)]/15 text-[var(--rasi-danger)]'
                          : 'bg-[var(--rasi-muted)]/15 text-[var(--rasi-muted)]'
                    }`}
                  >
                    {sec.medianChangeFraction !== null
                      ? `${(sec.medianChangeFraction * 100).toFixed(2)}%`
                      : '0.00%'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--rasi-muted)]">
                  <span>{sec.totalCompanies} emiten</span>
                  <span>•</span>
                  <span className="text-[var(--rasi-success)]">{sec.advancing} naik</span>
                  <span>•</span>
                  <span className="text-[var(--rasi-danger)]">{sec.declining} turun</span>
                </div>

                {/* Top Movers in Sector */}
                <div className="mt-3 space-y-1.5 border-t border-[var(--rasi-border)] pt-2.5">
                  {sec.topGainers.slice(0, 2).map((g) => (
                    <div
                      key={g.symbol}
                      className="flex items-center justify-between rounded-md border border-[var(--rasi-border)]/50 bg-[var(--rasi-surface-2)]/70 px-2 py-1 text-xs"
                    >
                      <Link
                        href={`/saham/${g.symbol}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-bold text-[var(--rasi-text)] hover:text-[var(--rasi-accent)] hover:underline"
                      >
                        {g.symbol}
                      </Link>
                      <span className="font-mono font-semibold tabular-nums text-[var(--rasi-success)]">
                        +{((g.dailyChange ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                  {sec.topLosers.slice(0, 1).map((l) => (
                    <div
                      key={l.symbol}
                      className="flex items-center justify-between rounded-md border border-[var(--rasi-border)]/50 bg-[var(--rasi-surface-2)]/70 px-2 py-1 text-xs"
                    >
                      <Link
                        href={`/saham/${l.symbol}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-bold text-[var(--rasi-text)] hover:text-[var(--rasi-accent)] hover:underline"
                      >
                        {l.symbol}
                      </Link>
                      <span className="font-mono font-semibold tabular-nums text-[var(--rasi-danger)]">
                        {((l.dailyChange ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Market Movers & Radar CTA */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Top Gainers */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)]">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--rasi-border)] pb-2">
            <h4 className="text-sm font-bold text-[var(--rasi-text)]">Top Gainers Terpantau</h4>
            <span className="text-xs text-[var(--rasi-muted)]">Perubahan 1 Sesi</span>
          </div>
          <div className="space-y-2">
            {topGainers.slice(0, 5).map((g) => (
              <div
                key={g.symbol}
                className="flex items-center justify-between border-b border-[var(--rasi-border)]/50 py-1 text-sm last:border-0"
              >
                <div>
                  <Link
                    href={`/saham/${g.symbol}`}
                    className="font-mono font-bold text-[var(--rasi-text)] hover:text-[var(--rasi-accent)] hover:underline"
                  >
                    {g.symbol}
                  </Link>
                  <p className="line-clamp-1 text-[11px] text-[var(--rasi-muted)]">{g.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold tabular-nums text-[var(--rasi-success)]">
                    +{((g.dailyChange ?? 0) * 100).toFixed(2)}%
                  </p>
                  <p className="font-mono text-[11px] text-[var(--rasi-muted)]">
                    {g.lastPrice ? `Rp${g.lastPrice.toLocaleString('id-ID')}` : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)]">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--rasi-border)] pb-2">
            <h4 className="text-sm font-bold text-[var(--rasi-text)]">Top Losers Terpantau</h4>
            <span className="text-xs text-[var(--rasi-muted)]">Perubahan 1 Sesi</span>
          </div>
          <div className="space-y-2">
            {topLosers.slice(0, 5).map((l) => (
              <div
                key={l.symbol}
                className="flex items-center justify-between border-b border-[var(--rasi-border)]/50 py-1 text-sm last:border-0"
              >
                <div>
                  <Link
                    href={`/saham/${l.symbol}`}
                    className="font-mono font-bold text-[var(--rasi-text)] hover:text-[var(--rasi-accent)] hover:underline"
                  >
                    {l.symbol}
                  </Link>
                  <p className="line-clamp-1 text-[11px] text-[var(--rasi-muted)]">{l.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold tabular-nums text-[var(--rasi-danger)]">
                    {((l.dailyChange ?? 0) * 100).toFixed(2)}%
                  </p>
                  <p className="font-mono text-[11px] text-[var(--rasi-muted)]">
                    {l.lastPrice ? `Rp${l.lastPrice.toLocaleString('id-ID')}` : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
