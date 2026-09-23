'use client'

import { formatForeignFlow, getStatusLabel } from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

export interface BrokerTabProps {
  bandarmology: StockDataResult['indicators']['bandarmology']
}

export function BrokerTab({ bandarmology }: BrokerTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--rasi-text)]">
          Transaksi broker dan investor asing
        </h3>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">
          Lihat porsi pembelian dan penjualan melalui broker terbesar pada hari bursa terakhir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">
            Pola pembelian dan penjualan
          </span>
          <span className="mt-2 block text-xl font-bold">
            {getStatusLabel(bandarmology.status).label}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            {bandarmology.flowSummary || 'Arus transaksi broker seimbang.'}
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">
            Porsi beli 3 broker terbesar
          </span>
          <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
            {bandarmology.cr3Buy !== null
              ? `${bandarmology.cr3Buy.toFixed(1)}%`
              : 'Data belum cukup'}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            Porsi dari total pembelian oleh 3 broker teratas
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">Transaksi investor asing</span>
          <span className="mt-2 block text-xl font-bold">
            {getStatusLabel(bandarmology.foreignFlowStatus).label}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            {formatForeignFlow(bandarmology.netForeignVal)}
          </span>
        </div>
      </div>
    </div>
  )
}
