'use client'

import React from 'react'
import type { SignalOutcome, SignalOutcomeStatus } from '@/lib/contracts/signal-analysis'

interface ActualOutcomesTableProps {
  outcomes: SignalOutcome[]
}

function getStatusBadge(status: SignalOutcomeStatus) {
  switch (status) {
    case 'MATURED':
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500 border border-emerald-500/20">
          Sudah dievaluasi
        </span>
      )
    case 'PENDING':
      return (
        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
          Menunggu akhir sesi
        </span>
      )
    case 'AWAITING_DATA':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
          Menunggu pembaruan data
        </span>
      )
    case 'MISSING_PRICE':
      return (
        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
          Harga sesi belum tersedia
        </span>
      )
    case 'CALENDAR_UNAVAILABLE':
      return (
        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400 border border-zinc-500/20">
          Kalender di luar rentang
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
          {status}
        </span>
      )
  }
}

export function ActualOutcomesTable({ outcomes }: ActualOutcomesTableProps) {
  if (!outcomes || outcomes.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-[var(--rasi-muted)]">
        Belum ada data evaluasi hasil sesi untuk sinyal ini.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[var(--rasi-border)]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] font-semibold text-[var(--rasi-muted)]">
            <tr>
              <th scope="col" className="px-3.5 py-2.5 text-center">
                Horizon
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Target Sesi & Tanggal
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right">
                Harga Aktual Akhir Horizon
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right">
                Return Kotor
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right">
                Return Bersih (Net Fee)
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--rasi-border)] text-[var(--rasi-text)]">
            {outcomes.map((o) => {
              const hasActual = o.actualPrice !== null && o.status === 'MATURED'
              return (
                <tr
                  key={`outcome-${o.horizon}`}
                  className="hover:bg-[var(--rasi-muted-bg)]/40 transition-colors"
                >
                  <td className="px-3.5 py-3 text-center font-mono font-bold">
                    {o.horizon} Sesi
                  </td>
                  <td className="px-3.5 py-3 font-mono text-[var(--rasi-muted)]">
                    <span className="font-semibold text-[var(--rasi-text)]">
                      Sesi {o.targetSession === 'S1' ? 'I' : 'II'}
                    </span>{' '}
                    — {o.targetDate || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums">
                    {hasActual
                      ? `Rp ${o.actualPrice!.toLocaleString('id-ID')}`
                      : '—'}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums">
                    {hasActual && o.grossReturn !== null ? (
                      <span
                        className={
                          o.grossReturn >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'
                        }
                      >
                        {o.grossReturn >= 0 ? '+' : ''}
                        {(o.grossReturn * 100).toFixed(2)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono tabular-nums">
                    {hasActual && o.netReturn !== null ? (
                      <span
                        className={
                          o.netReturn >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'
                        }
                      >
                        {o.netReturn >= 0 ? '+' : ''}
                        {(o.netReturn * 100).toFixed(2)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {getStatusBadge(o.status)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[var(--rasi-muted)] leading-relaxed">
        * <strong>Harga aktual akhir horizon</strong> adalah observasi penutupan sesi kontinu target yang sah, bukan estimasi proyeksi dan bukan target take profit. Return bersih telah memperhitungkan estimasi biaya transaksi beli (0,15%) dan jual (0,25%).
      </p>
    </div>
  )
}
