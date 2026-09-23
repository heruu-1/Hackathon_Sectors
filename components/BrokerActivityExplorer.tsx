'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import Link from 'next/link'

import { ArrowRightLeft, Building2, Loader2, TrendingDown, TrendingUp } from 'lucide-react'

import { compareBrokersAction, getBrokerActivityAction, getBrokerListAction } from '@/app/actions'
import type { BrokerActivitySummary, DualBrokerComparison } from '@/domain/broker-activity'
import type { BrokerRegistryEntry } from '@/lib/contracts/market'

interface BrokerActivityExplorerProps {
  initialRegistry?: Record<string, BrokerRegistryEntry>
  initialSummary?: BrokerActivitySummary | null
}

export function BrokerActivityExplorer({
  initialRegistry,
  initialSummary,
}: BrokerActivityExplorerProps = {}) {
  const [registry, setRegistry] = useState<Record<string, BrokerRegistryEntry>>(
    initialRegistry || {},
  )
  const [selectedBrokerA, setSelectedBrokerA] = useState('YP') // Default Mirae
  const [selectedBrokerB, setSelectedBrokerB] = useState('CC') // Default Mandiri
  const [isComparing, setIsComparing] = useState(false)
  const [rangeDays, setRangeDays] = useState<'1' | '5' | '14'>('5')

  const [loading, setLoading] = useState(false)
  const [summaryA, setSummaryA] = useState<BrokerActivitySummary | null>(initialSummary || null)
  const [comparison, setComparison] = useState<DualBrokerComparison | null>(null)
  const [error, setError] = useState('')

  // Load registry once if not supplied
  useEffect(() => {
    if (Object.keys(registry).length > 0) return
    getBrokerListAction().then((res) => {
      if (res.success && res.data) {
        setRegistry(res.data)
      }
    })
  }, [registry])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    const endDate = new Date().toISOString().split('T')[0]
    const days = Number(rangeDays)
    const startDate = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().split('T')[0]

    try {
      if (isComparing) {
        const res = await compareBrokersAction(selectedBrokerA, selectedBrokerB, startDate, endDate)
        if (res.success && res.data) {
          setComparison(res.data)
        } else {
          setError(res.error || 'Gagal memuat perbandingan broker.')
        }
      } else {
        const res = await getBrokerActivityAction(selectedBrokerA, startDate, endDate)
        if (res.success && res.data) {
          setSummaryA(res.data)
        } else {
          setError(res.error || 'Gagal memuat aktivitas broker.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }, [selectedBrokerA, selectedBrokerB, isComparing, rangeDays])

  // Skip the first fetch if initialSummary is already provided
  const hasInitializedRef = useRef(Boolean(initialSummary))

  useEffect(() => {
    if (hasInitializedRef.current) {
      hasInitializedRef.current = false
      return
    }
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void fetchData()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [fetchData])

  const brokerList = Object.values(registry).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Broker A Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--rasi-muted)]">Broker:</span>
              <select
                value={selectedBrokerA}
                onChange={(e) => setSelectedBrokerA(e.target.value)}
                className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-3 py-1.5 font-mono text-sm font-bold text-[var(--rasi-text)]"
              >
                {brokerList.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.name} {b.is_foreign ? '(Asing)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Compare Toggle */}
            <button
              type="button"
              onClick={() => setIsComparing(!isComparing)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isComparing
                  ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)]/10 text-[var(--rasi-primary)]'
                  : 'border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>{isComparing ? 'Bandingkan Aktif' : 'Bandingkan 2 Broker'}</span>
            </button>

            {/* Broker B Selector if comparing */}
            {isComparing && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--rasi-muted)]">vs:</span>
                <select
                  value={selectedBrokerB}
                  onChange={(e) => setSelectedBrokerB(e.target.value)}
                  className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-3 py-1.5 font-mono text-sm font-bold text-[var(--rasi-text)]"
                >
                  {brokerList.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} - {b.name} {b.is_foreign ? '(Asing)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs text-[var(--rasi-muted)]">Periode:</span>
            {(['1', '5', '14'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  rangeDays === d
                    ? 'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)]'
                    : 'bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                {d === '1' ? '1 Sesi' : d === '5' ? '5 Sesi' : '14 Hari (Maks)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--rasi-primary)]" />
          <span className="ml-2 text-sm text-[var(--rasi-muted)]">Memuat aktivitas broker...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Comparison View */}
      {!loading && isComparing && comparison && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
            <h3 className="text-base font-bold text-[var(--rasi-text)]">
              Kesimpulan Perbandingan: {comparison.brokerA.brokerCode} vs{' '}
              {comparison.brokerB.brokerCode}
            </h3>
            <p className="mt-1 text-xs text-[var(--rasi-muted)]">{comparison.overallSummary}</p>
          </div>

          {/* Common stocks table */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[var(--rasi-text)]">
              Saham yang Sama-sama Ditransaksikan ({comparison.commonStocks.length})
            </h4>
            <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                  <tr>
                    <th className="p-3">Saham</th>
                    <th className="p-3 text-right">Net {comparison.brokerA.brokerCode}</th>
                    <th className="p-3 text-right">Net {comparison.brokerB.brokerCode}</th>
                    <th className="p-3 text-center">Arah</th>
                    <th className="p-3">Ringkasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rasi-border)]">
                  {comparison.commonStocks.map((c) => (
                    <tr key={c.symbol} className="hover:bg-[var(--rasi-muted-bg)]">
                      <td className="p-3">
                        <Link
                          href={`/saham/${c.symbol}`}
                          className="font-mono font-bold text-[var(--rasi-primary)] hover:underline"
                        >
                          {c.symbol}
                        </Link>
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          c.brokerANet > 0
                            ? 'text-emerald-400'
                            : c.brokerANet < 0
                              ? 'text-rose-400'
                              : ''
                        }`}
                      >
                        Rp {(c.brokerANet / 1e9).toFixed(1)} M
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          c.brokerBNet > 0
                            ? 'text-emerald-400'
                            : c.brokerBNet < 0
                              ? 'text-rose-400'
                              : ''
                        }`}
                      >
                        Rp {(c.brokerBNet / 1e9).toFixed(1)} M
                      </td>
                      <td className="p-3 text-center">
                        {c.alignment === 'AGREE_ACCUMULATION' && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            Kompak Akumulasi
                          </span>
                        )}
                        {c.alignment === 'AGREE_DISTRIBUTION' && (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            Kompak Distribusi
                          </span>
                        )}
                        {c.alignment === 'OPPOSING' && (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            Berlawanan
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[var(--rasi-muted)]">{c.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Single Broker View */}
      {!loading && !isComparing && summaryA && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">Broker Terpilih</span>
              <span className="mt-1 block font-mono text-xl font-bold text-[var(--rasi-text)]">
                {summaryA.brokerCode}
              </span>
              <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                {summaryA.brokerName} {summaryA.isForeign ? '• Asing' : '• Domestik'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Total Transaksi (Gross)
              </span>
              <span className="mt-1 block font-mono text-xl font-bold text-[var(--rasi-text)] tabular-nums">
                Rp {(summaryA.totalGrossValue / 1e9).toFixed(1)} M
              </span>
              <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                Akumulasi beli + jual
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">Net Transaksi</span>
              <span
                className={`mt-1 block font-mono text-xl font-bold tabular-nums ${
                  summaryA.totalNetValue > 0
                    ? 'text-emerald-400'
                    : summaryA.totalNetValue < 0
                      ? 'text-rose-400'
                      : 'text-[var(--rasi-text)]'
                }`}
              >
                Rp {(summaryA.totalNetValue / 1e9).toFixed(1)} M
              </span>
              <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                {summaryA.totalNetValue > 0 ? 'Net Akumulasi' : 'Net Distribusi'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">Cakupan Pengamatan</span>
              <span className="mt-1 block text-sm font-bold text-[var(--rasi-text)]">
                {summaryA.periodStart} s/d {summaryA.periodEnd}
              </span>
              <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                Rentang kalender terverifikasi
              </span>
            </div>
          </div>

          {/* Top Rankings: 3 columns */}
          {summaryA.totalGrossValue === 0 ? (
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-8 text-center shadow-sm">
              <Building2 className="mx-auto h-8 w-8 text-[var(--rasi-muted)]" />
              <p className="mt-2 text-sm font-semibold text-[var(--rasi-text)]">
                Tidak ada transaksi tercatat untuk broker {summaryA.brokerCode} pada periode ini
              </p>
              <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                Rentang: {summaryA.periodStart || 'Terkini'} s/d {summaryA.periodEnd || 'Terkini'}.
                Hal ini biasanya terjadi jika bursa sedang libur, akhir pekan, atau belum ada
                transaksi pada rentang yang dipilih.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRangeDays('5')}
                  className="rounded-lg bg-[var(--rasi-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--rasi-primary-text)] shadow-sm hover:opacity-90"
                >
                  Pilih Periode 5 Sesi
                </button>
                <button
                  type="button"
                  onClick={() => setRangeDays('14')}
                  className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--rasi-text)] hover:border-[var(--rasi-text)]"
                >
                  Pilih Periode 14 Hari
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Top Net Buy */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-[var(--rasi-text)]">Top Net Buy</h4>
                </div>
                <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                      <tr>
                        <th className="p-2.5">Saham</th>
                        <th className="p-2.5 text-right">Net (Rp)</th>
                        <th className="p-2.5 text-right">Pangsa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rasi-border)]">
                      {summaryA.topNetBuy.map((s) => (
                        <tr key={s.symbol} className="hover:bg-[var(--rasi-muted-bg)]">
                          <td className="p-2.5">
                            <Link
                              href={`/saham/${s.symbol}`}
                              className="font-mono font-bold text-[var(--rasi-primary)] hover:underline"
                            >
                              {s.symbol}
                            </Link>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                            +{(s.netValue / 1e9).toFixed(1)}M
                          </td>
                          <td className="p-2.5 text-right font-mono text-[var(--rasi-muted)]">
                            {s.grossSharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Net Sell */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  <h4 className="text-sm font-bold text-[var(--rasi-text)]">Top Net Sell</h4>
                </div>
                <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                      <tr>
                        <th className="p-2.5">Saham</th>
                        <th className="p-2.5 text-right">Net (Rp)</th>
                        <th className="p-2.5 text-right">Pangsa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rasi-border)]">
                      {summaryA.topNetSell.map((s) => (
                        <tr key={s.symbol} className="hover:bg-[var(--rasi-muted-bg)]">
                          <td className="p-2.5">
                            <Link
                              href={`/saham/${s.symbol}`}
                              className="font-mono font-bold text-[var(--rasi-primary)] hover:underline"
                            >
                              {s.symbol}
                            </Link>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                            {(s.netValue / 1e9).toFixed(1)}M
                          </td>
                          <td className="p-2.5 text-right font-mono text-[var(--rasi-muted)]">
                            {s.grossSharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Gross */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--rasi-primary)]" />
                  <h4 className="text-sm font-bold text-[var(--rasi-text)]">Top Gross Transaksi</h4>
                </div>
                <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                      <tr>
                        <th className="p-2.5">Saham</th>
                        <th className="p-2.5 text-right">Gross</th>
                        <th className="p-2.5 text-right">Pangsa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rasi-border)]">
                      {summaryA.topGross.map((s) => (
                        <tr key={s.symbol} className="hover:bg-[var(--rasi-muted-bg)]">
                          <td className="p-2.5">
                            <Link
                              href={`/saham/${s.symbol}`}
                              className="font-mono font-bold text-[var(--rasi-primary)] hover:underline"
                            >
                              {s.symbol}
                            </Link>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-[var(--rasi-text)]">
                            {(s.grossValue / 1e9).toFixed(1)}M
                          </td>
                          <td className="p-2.5 text-right font-mono text-[var(--rasi-muted)]">
                            {s.grossSharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
