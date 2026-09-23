'use client'

import Link from 'next/link'

import type { StockDataResult } from '@/lib/server/services/analysis'

export interface ValuationTabProps {
  data: StockDataResult
  symbol: string
}

export function ValuationTab({ data, symbol }: ValuationTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--rasi-text)]">
          Valuasi Relatif & Pembanding Industri
        </h3>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">
          Bandingkan valuasi {symbol} terhadap median emiten sejenis dalam{' '}
          <strong className="text-[var(--rasi-text)]">
            {data?.peerComparison?.peerGroupName ?? 'Kelompok Industri'}
          </strong>
          .
        </p>
      </div>

      {/* R06 Value Trap Alert */}
      {data?.peerComparison?.ruleR06.triggered && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <strong className="font-semibold text-amber-300">
            ⚠️ Peringatan Valuasi Semu (R06):
          </strong>{' '}
          {data.peerComparison.ruleR06.explanation}
        </div>
      )}

      {/* Sample size warning */}
      {data?.peerComparison && !data.peerComparison.isSampleSufficient && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-300">
          ℹ️ Jumlah pembanding aktif kurang dari 5 emiten; median mungkin kurang representatif.
        </div>
      )}

      {/* Valuation Ranks Grid */}
      {data?.peerComparison && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
            <span className="block text-xs text-[var(--rasi-muted)]">P/E vs Median</span>
            <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
              {data.peerComparison.peRank.value !== null
                ? `${data.peerComparison.peRank.value.toFixed(1)}x`
                : 'N/A'}
            </span>
            <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
              Median: {data.peerComparison.peRank.median?.toFixed(1) ?? 'N/A'}x
            </span>
            <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
              {data.peerComparison.peRank.summaryLabel}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
            <span className="block text-xs text-[var(--rasi-muted)]">P/B vs Median</span>
            <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
              {data.peerComparison.pbRank.value !== null
                ? `${data.peerComparison.pbRank.value.toFixed(1)}x`
                : 'N/A'}
            </span>
            <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
              Median: {data.peerComparison.pbRank.median?.toFixed(1) ?? 'N/A'}x
            </span>
            <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
              {data.peerComparison.pbRank.summaryLabel}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
            <span className="block text-xs text-[var(--rasi-muted)]">ROE vs Median</span>
            <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
              {data.peerComparison.roeRank.value !== null
                ? `${(data.peerComparison.roeRank.value * 100).toFixed(1)}%`
                : 'N/A'}
            </span>
            <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
              Median:{' '}
              {data.peerComparison.roeRank.median
                ? `${(data.peerComparison.roeRank.median * 100).toFixed(1)}%`
                : 'N/A'}
            </span>
            <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
              {data.peerComparison.roeRank.summaryLabel}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
            <span className="block text-xs text-[var(--rasi-muted)]">Dividend Yield vs Median</span>
            <span className="mt-1 block font-mono text-2xl font-bold tabular-nums">
              {data.peerComparison.dividendYieldRank.value !== null
                ? `${(data.peerComparison.dividendYieldRank.value * 100).toFixed(1)}%`
                : 'N/A'}
            </span>
            <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
              Median:{' '}
              {data.peerComparison.dividendYieldRank.median
                ? `${(data.peerComparison.dividendYieldRank.median * 100).toFixed(1)}%`
                : 'N/A'}
            </span>
            <span className="mt-2 inline-block rounded bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-semibold">
              {data.peerComparison.dividendYieldRank.summaryLabel}
            </span>
          </div>
        </div>
      )}

      {/* Peers Table */}
      {data?.peerComparison?.peers && data.peerComparison.peers.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[var(--rasi-text)]">
            Daftar Emiten Pembanding ({data.peerComparison.peers.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                <tr>
                  <th className="p-3">Emiten</th>
                  <th className="p-3 text-right">P/E</th>
                  <th className="p-3 text-right">P/B</th>
                  <th className="p-3 text-right">ROE</th>
                  <th className="p-3 text-right">Div Yield</th>
                  <th className="p-3 text-right">Kapitalisasi Pasar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rasi-border)]">
                {data.peerComparison.peers.map((peer) => (
                  <tr
                    key={peer.symbol}
                    className={`transition-colors hover:bg-[var(--rasi-muted-bg)] ${
                      peer.symbol === symbol ? 'bg-[var(--rasi-primary)]/10 font-bold' : ''
                    }`}
                  >
                    <td className="p-3">
                      <Link
                        href={`/saham/${peer.symbol}`}
                        className="font-mono text-[var(--rasi-primary)] hover:underline"
                      >
                        {peer.symbol}
                      </Link>
                      {peer.symbol === symbol && (
                        <span className="ml-2 rounded bg-[var(--rasi-primary)]/20 px-1.5 py-0.5 text-[10px] text-[var(--rasi-primary)]">
                          Saham ini
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peer.pe !== null ? `${peer.pe.toFixed(1)}x` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peer.pb !== null ? `${peer.pb.toFixed(1)}x` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peer.roe !== null ? `${(peer.roe * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peer.dividendYield !== null
                        ? `${(peer.dividendYield * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peer.marketCap !== null
                        ? `Rp ${(peer.marketCap / 1_000_000_000_000).toFixed(1)} T`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
