'use client'

import type { StockDataResult } from '@/lib/server/services/analysis'

export interface InsiderTabProps {
  insider: StockDataResult['indicators']['insider']
}

export function InsiderTab({ insider }: InsiderTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--rasi-text)]">
          Jual beli pengurus dan pemegang saham besar
        </h3>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">
          Laporan pembelian atau penjualan saham oleh direksi, komisaris, dan pemegang saham
          pengendali.
        </p>
      </div>

      {insider.latestFiling ? (
        <div className="space-y-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--rasi-text)]">
              {insider.latestFiling.holderName}
            </span>
            <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2 py-0.5 text-xs font-bold">
              {insider.latestFiling.action === 'BUY' ? 'Pembelian' : 'Penjualan'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-[var(--rasi-muted)]">
            <div>
              Jumlah saham:{' '}
              <strong className="font-mono text-[var(--rasi-text)]">
                {insider.latestFiling.amountShares.toLocaleString('id-ID')}
              </strong>
            </div>
            <div>
              Perkiraan nilai:{' '}
              <strong className="font-mono text-[var(--rasi-text)]">
                Rp {(insider.latestFiling.totalValueIdr / 1_000_000_000).toFixed(2)} M
              </strong>
            </div>
            <div>
              Tanggal:{' '}
              <strong className="text-[var(--rasi-text)]">{insider.latestFiling.date}</strong>
            </div>
            <div>
              Perubahan kepemilikan:{' '}
              <strong className="font-mono text-[var(--rasi-text)]">
                {insider.latestFiling.pctChanged !== null
                  ? `${(insider.latestFiling.pctChanged * 100).toFixed(2)}%`
                  : '—'}
              </strong>
            </div>
          </div>

          <p className="border-t border-[var(--rasi-border)] pt-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
            {insider.summary}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-8 text-center text-xs text-[var(--rasi-muted)]">
          Belum ada laporan jual beli saham dari pengurus perusahaan untuk saham ini.
        </div>
      )}
    </div>
  )
}
