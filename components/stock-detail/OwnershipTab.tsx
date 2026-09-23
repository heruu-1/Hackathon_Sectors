'use client'

import type { StockDataResult } from '@/lib/server/services/analysis'

export interface OwnershipTabProps {
  data: StockDataResult
}

export function OwnershipTab({ data }: OwnershipTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--rasi-text)]">
          Struktur Kepemilikan & Free Float
        </h3>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">
          Komposisi pemegang saham pengendali, saham publik (free float), dan pergeseran antarbulan.
        </p>
      </div>

      {/* Free Float & Controlling Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">Free Float Publik</span>
          <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
            {data?.ownership?.freeFloat.percentage !== null &&
            data?.ownership?.freeFloat.percentage !== undefined
              ? `${data.ownership.freeFloat.percentage.toFixed(2)}%`
              : 'Data tidak tersedia'}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            {data?.ownership?.freeFloat.definition}
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">Porsi Pemegang Pengendali</span>
          <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
            {data?.ownership?.totalControllingPct !== null &&
            data?.ownership?.totalControllingPct !== undefined
              ? `${data.ownership.totalControllingPct.toFixed(2)}%`
              : 'N/A'}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            Akumulasi kepemilikan pihak pengendali terdaftar
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">Pergeseran Antarbulan</span>
          <span className="mt-2 block text-sm font-semibold">
            {data?.ownership?.shift?.summary ??
              'Data pergeseran bulanan belum mencukupi minimal 2 periode.'}
          </span>
        </div>
      </div>

      {/* Top Shareholders Table */}
      {data?.ownership?.topShareholders && data.ownership.topShareholders.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[var(--rasi-text)]">
            Pemegang Saham Terbesar ({data.ownership.topShareholders.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-[var(--rasi-border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
                <tr>
                  <th className="p-3">Nama Pemegang Saham</th>
                  <th className="p-3 text-right">Jumlah Saham</th>
                  <th className="p-3 text-right">Persentase</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rasi-border)]">
                {data.ownership.topShareholders.map((sh, idx) => (
                  <tr key={idx} className="hover:bg-[var(--rasi-muted-bg)]">
                    <td className="p-3 font-medium">{sh.name}</td>
                    <td className="p-3 text-right font-mono">
                      {sh.shares ? sh.shares.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {sh.percentage ? `${sh.percentage.toFixed(2)}%` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      {sh.isController ? (
                        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          Pengendali
                        </span>
                      ) : (
                        <span className="rounded bg-gray-500/20 px-2 py-0.5 text-[10px] text-[var(--rasi-muted)]">
                          Publik / Lainnya
                        </span>
                      )}
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
