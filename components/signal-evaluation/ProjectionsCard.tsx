'use client'

import React from 'react'
import type { ProjectionResult } from '@/lib/contracts/signal-analysis'
import { AlertCircle, TrendingUp, Activity, BarChart2 } from 'lucide-react'

interface ProjectionsCardProps {
  projection: ProjectionResult
}

export function ProjectionsCard({ projection }: ProjectionsCardProps) {
  if (projection.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-xs text-[var(--rasi-text)] space-y-3">
        <div className="flex items-center gap-2 font-bold text-amber-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Riwayat Data Belum Memenuhi Syarat Kalibrasi Proyeksi</span>
        </div>
        <p className="text-[var(--rasi-muted)] leading-relaxed">
          Model stokastik Geometric Brownian Motion (GBM) memerlukan minimal <strong>20 hari bursa lengkap</strong> dan <strong>20 observasi gap sesi kontinu</strong> sebelum waktu evaluasi untuk mengestimasi volatilitas S1/S2 dan gap secara reliabel.
        </p>
        <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-[11px] font-mono text-[var(--rasi-muted)]">
          Catatan: {projection.notes || 'Data historis tidak mencukupi.'}
        </div>
        <p className="text-[11px] text-[var(--rasi-muted)]">
          ✓ Hasil aktual dan rencana manajemen risiko tetap sah dan dapat dipantau seperti biasa.
        </p>
      </div>
    )
  }

  const { probabilities, priceDistributions, dynamicStrategy, sensitivities } = projection

  return (
    <div className="space-y-5 text-xs text-[var(--rasi-text)]">
      {/* 1. Touch Probabilities Section */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="font-bold uppercase tracking-wider text-[var(--rasi-text)] flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-[var(--rasi-primary)]" />
            Estimasi Probabilitas Sentuhan Level (100.000 Lintasan GBM)
          </h3>
          <span className="text-[11px] font-mono text-[var(--rasi-muted)]">
            Partisi Total: {(probabilities.sumCheck * 100).toFixed(1)}%
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* TP1 Before SL */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <span className="text-[11px] font-semibold text-emerald-400">
              P(TP1 sebelum SL)
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-500">
              {(probabilities.pTp1BeforeSl * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-[var(--rasi-muted)]">
              Sentuh TP1 sebelum tersentuh SL
            </span>
          </div>

          {/* SL Before TP1 */}
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <span className="text-[11px] font-semibold text-rose-400">
              P(SL sebelum TP1)
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-rose-500">
              {(probabilities.pSlBeforeTp1 * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-[var(--rasi-muted)]">
              Sentuh SL sebelum menyentuh TP1
            </span>
          </div>

          {/* Neither Touched */}
          <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/30 p-3">
            <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
              P(Belum Tersentuh)
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--rasi-text)]">
              {(probabilities.pNeitherTouched * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-[var(--rasi-muted)]">
              Bertahan di rentang sampai H5
            </span>
          </div>

          {/* TP2 Before SL (Independent Metric) */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <span className="text-[11px] font-semibold text-emerald-400">
              P(TP2 sebelum SL) *
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-500">
              {(probabilities.pTp2BeforeSl * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-[var(--rasi-muted)]">
              * Metrik terpisah (sub-lintasan TP1)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Projected Terminal Price Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Horizon 3 & 5 Price Range */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4 space-y-3">
          <h4 className="font-semibold text-[var(--rasi-text)] flex items-center gap-1.5 border-b border-[var(--rasi-border)] pb-2">
            <BarChart2 className="h-4 w-4 text-[var(--rasi-primary)]" />
            Distribusi Rentang Harga Akhir Sesi (80% Confidence Interval)
          </h4>

          <div className="space-y-3 pt-1">
            {/* Horizon 3 */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/30 p-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-[var(--rasi-text)]">Horizon 3 Sesi</span>
                <p className="text-[11px] text-[var(--rasi-muted)]">
                  Rentang 80% (P10 – P90): Rp {priceDistributions[3].p10.toLocaleString('id-ID')} – Rp {priceDistributions[3].p90.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--rasi-muted)] uppercase">Median</span>
                <p className="font-mono font-bold text-[var(--rasi-primary)] text-sm">
                  Rp {priceDistributions[3].median.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* Horizon 5 */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/30 p-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-[var(--rasi-text)]">Horizon 5 Sesi</span>
                <p className="text-[11px] text-[var(--rasi-muted)]">
                  Rentang 80% (P10 – P90): Rp {priceDistributions[5].p10.toLocaleString('id-ID')} – Rp {priceDistributions[5].p90.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--rasi-muted)] uppercase">Median</span>
                <p className="font-mono font-bold text-[var(--rasi-primary)] text-sm">
                  Rp {priceDistributions[5].median.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Strategy Performance */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4 space-y-3">
          <h4 className="font-semibold text-[var(--rasi-text)] flex items-center gap-1.5 border-b border-[var(--rasi-border)] pb-2">
            <TrendingUp className="h-4 w-4 text-[var(--rasi-primary)]" />
            Ekspektasi Strategi Bertahap (Trailing Stop + Time Stop)
          </h4>

          <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-2.5">
              <span className="text-[10px] text-[var(--rasi-muted)] uppercase">Win Rate</span>
              <p className="mt-1 font-mono text-base font-bold text-emerald-500">
                {dynamicStrategy.winRatePct}%
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-2.5">
              <span className="text-[10px] text-[var(--rasi-muted)] uppercase">Return Bersih</span>
              <p className="mt-1 font-mono text-base font-bold text-[var(--rasi-primary)]">
                {dynamicStrategy.expectedReturnNetPct >= 0 ? '+' : ''}{dynamicStrategy.expectedReturnNetPct}%
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-2.5">
              <span className="text-[10px] text-[var(--rasi-muted)] uppercase">Avg R-Multiple</span>
              <p className="mt-1 font-mono text-base font-bold text-[var(--rasi-text)]">
                {dynamicStrategy.avgRMultiple}R
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[var(--rasi-muted)] leading-relaxed">
            Simulasi mengunci 50% lot saat TP1, mengaktifkan trailing stop untuk 50% sisanya, dan menutup sisa posisi pada harga penutupan Horizon 5 (time stop).
          </p>
        </div>
      </div>

      {/* 3. Sensitivity Analysis Table */}
      <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--surface-card)] p-4 space-y-3">
        <h4 className="font-semibold text-[var(--rasi-text)]">
          Uji Sensitivitas Volatilitas & Slippage
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)]">
              <tr>
                <th className="px-3 py-2">Skenario Uji</th>
                <th className="px-3 py-2 text-right">P(TP1)</th>
                <th className="px-3 py-2 text-right">P(SL)</th>
                <th className="px-3 py-2 text-right">Risiko Bersih (R)</th>
                <th className="px-3 py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rasi-border)] font-mono">
              <tr>
                <td className="px-3 py-2 font-semibold font-sans">Baseline Kalibrasi</td>
                <td className="px-3 py-2 text-right text-emerald-500 font-bold">
                  {(probabilities.pTp1BeforeSl * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-rose-500 font-bold">
                  {(probabilities.pSlBeforeTp1 * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right">
                  Rp {sensitivities.slippage2Ticks.netRisk > 0 ? (sensitivities.slippage2Ticks.netRisk - 10).toFixed(2) : '—'}
                </td>
                <td className="px-3 py-2 font-sans text-[var(--rasi-muted)]">Volatilitas historis normal</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-semibold font-sans">Volatilitas Tinggi (+25%)</td>
                <td className="px-3 py-2 text-right text-emerald-500">
                  {(sensitivities.volPlus25.pTp1 * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-rose-500">
                  {(sensitivities.volPlus25.pSl * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 font-sans text-[var(--rasi-muted)]">Fluktuasi pasar meningkat</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-semibold font-sans">Volatilitas Rendah (-25%)</td>
                <td className="px-3 py-2 text-right text-emerald-500">
                  {(sensitivities.volMinus25.pTp1 * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-rose-500">
                  {(sensitivities.volMinus25.pSl * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 font-sans text-[var(--rasi-muted)]">Pasar bergerak lebih lambat</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-semibold font-sans">Slippage Eksekusi 2 Tick</td>
                <td className="px-3 py-2 text-right text-emerald-500">
                  {(sensitivities.slippage2Ticks.pTp1 * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-rose-500">
                  {(sensitivities.slippage2Ticks.pSl * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right font-bold text-rose-400">
                  Rp {sensitivities.slippage2Ticks.netRisk.toLocaleString('id-ID')}
                </td>
                <td className="px-3 py-2 font-sans text-[var(--rasi-muted)]">Uji pelebaran spread bid-ask</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
