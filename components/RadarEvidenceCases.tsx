'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react'

import { runMarketScanAction } from '@/app/actions'
import { Button } from '@/components/ui'
import type { CandidateRadarCase, MarketScanResult } from '@/lib/server/services/market-scan'

export function RadarEvidenceCases() {
  const [data, setData] = useState<MarketScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL')
  const [refreshing, setRefreshing] = useState(false)

  async function loadScan(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await runMarketScanAction({ forceRefresh })
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Gagal memuat kasus radar.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadScan()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--rasi-border)]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)]"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-8 text-center shadow-[var(--rasi-card-shadow)]">
        <AlertTriangle className="mx-auto h-8 w-8 text-[var(--rasi-danger)]" />
        <p className="mt-2 text-sm font-semibold text-[var(--rasi-text)]">
          Gagal memuat Radar Kasus Bukti
        </p>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">{error}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => loadScan(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
        </Button>
      </div>
    )
  }

  const { radarCases, marketCutoffDate, coverage } = data

  const filteredCases = radarCases.filter((c) => {
    if (selectedFilter === 'ALL') return true
    if (selectedFilter === 'CONFLICTING') return c.conflictingEvidence.length > 0
    if (selectedFilter === 'ALIGNED') return c.alignedEvidence.length > 0
    if (selectedFilter === 'VOLUME') {
      return c.rulesMatched.some((r) => r.ruleId === 'R04')
    }
    if (selectedFilter === 'MISSING') return c.missingData.length > 0
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--rasi-primary)]" />
            <h2 className="text-base font-bold text-[var(--rasi-text)]">
              Radar Bukti — Deteksi Anomali & Pertentangan Bukti
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            Cutoff: {marketCutoffDate} • {coverage.candidatesEvaluated} kandidat dianalisis mendalam
            dari {coverage.totalUniverse} emiten universe terpantau
          </p>
        </div>

        <Button variant="secondary" size="sm" disabled={refreshing} onClick={() => loadScan(true)}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Perbarui Pindaian
        </Button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: `Semua Kasus (${radarCases.length})` },
          { id: 'CONFLICTING', label: 'Bukti Berlawanan' },
          { id: 'ALIGNED', label: 'Bukti Searah' },
          { id: 'VOLUME', label: 'Volume Melonjak' },
          { id: 'MISSING', label: 'Perlu Data Tambahan' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              selectedFilter === f.id
                ? 'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-sm'
                : 'border border-[var(--rasi-border)] bg-[var(--rasi-card)] text-[var(--rasi-muted)] hover:border-[var(--rasi-text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Case Cards Grid */}
      {filteredCases.length === 0 ? (
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-12 text-center text-sm text-[var(--rasi-muted)]">
          Tidak ada kasus yang memenuhi kriteria filter ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredCases.map((item) => (
            <div
              key={item.ticker}
              className="rasi-ambient-top-cyan flex flex-col justify-between rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)] transition-all hover:border-[var(--rasi-accent)]/50 hover:shadow-[var(--rasi-card-shadow)]"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/saham/${item.ticker}`}
                        className="text-lg font-bold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline"
                      >
                        {item.ticker}
                      </Link>
                      <span className="line-clamp-1 text-xs text-[var(--rasi-muted)]">
                        {item.companyName}
                      </span>
                    </div>
                    {item.observationPeriod.start && (
                      <p className="mt-0.5 text-[11px] text-[var(--rasi-muted)]">
                        Observasi: {item.observationPeriod.start} s/d {item.observationPeriod.end}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/saham/${item.ticker}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rasi-primary)] hover:underline"
                  >
                    Riset <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Reasons for Radar */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.reasonsForRadar.map((r, i) => (
                    <span
                      key={i}
                      className="rounded bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--rasi-text)]"
                    >
                      {r}
                    </span>
                  ))}
                </div>

                {/* Conflicting Evidence */}
                {item.conflictingEvidence.length > 0 && (
                  <div className="rasi-alert-danger mt-4 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Bukti Berlawanan Arah (Divergensi)</span>
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs opacity-90">
                      {item.conflictingEvidence.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Aligned Evidence */}
                {item.alignedEvidence.length > 0 && (
                  <div className="mt-3 rounded-lg border border-[var(--rasi-success)]/30 bg-[var(--rasi-success)]/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--rasi-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Bukti Searah</span>
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[var(--rasi-success)]/90">
                      {item.alignedEvidence.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing Data */}
                {item.missingData.length > 0 && (
                  <div className="mt-3 rounded-lg border border-[var(--rasi-muted)]/30 bg-[var(--rasi-card)] p-2.5 text-xs text-[var(--rasi-muted)]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Data Belum Tersedia:</span>
                    </div>
                    <p className="mt-1 text-[11px]">{item.missingData.join(', ')}</p>
                  </div>
                )}
              </div>

              {/* Next Research Steps */}
              <div className="mt-4 border-t border-[var(--rasi-border)] pt-3">
                <p className="text-[11px] font-semibold tracking-wider text-[var(--rasi-muted)] uppercase">
                  Langkah Riset Selanjutnya:
                </p>
                <ul className="mt-1 space-y-1 text-xs text-[var(--rasi-text)]">
                  {item.nextResearchSteps.slice(0, 2).map((s, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-[var(--rasi-primary)]" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
