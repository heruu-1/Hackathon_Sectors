'use client'

import { HelpCircle } from 'lucide-react'

import type { ModePreference } from '@/components/ThemePreferenceProvider'
import { METRIC_EXPLANATIONS, getStatusLabel } from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

export interface FundamentalTabProps {
  data: StockDataResult
  mode: ModePreference
  peVal: number | null
  pbVal: number | null
}

export function FundamentalTab({ data, mode, peVal, pbVal }: FundamentalTabProps) {
  const fundamental = data.indicators.fundamental

  return (
    <div className="space-y-6">
      {mode === 'beginner' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-950 dark:border-blue-900 dark:bg-[#071328] dark:text-blue-200">
          <strong> Cara membaca keuangan: </strong> Evaluasi kinerja bisnis membandingkan kuartal
          terkini dengan periode sama tahun sebelumnya (YoY). Perusahaan keuangan (bank) dinilai
          dari pertumbuhan bunga dan kredit, sedangkan perusahaan nonkeuangan dinilai dari
          pendapatan, laba, dan arus kas operasi.{' '}
        </div>
      )}

      {/* R07 Divergence Warning if present */}
      {data?.fundamentals &&
        'isCashFlowDivergent' in data.fundamentals &&
        data.fundamentals.isCashFlowDivergent && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <strong className="font-semibold text-amber-300">
              ⚠️ Divergensi Arus Kas Operasi (R07):
            </strong>{' '}
            Perusahaan membukukan laba bersih positif, namun arus kas operasi negatif. Periksa
            apakah laba tertahan di piutang atau persediaan sebelum mengambil kesimpulan.
          </div>
        )}

      {/* Bank Layout */}
      {data?.fundamentals?.group === 'BANK' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--rasi-text)]">
              Kinerja Perbankan & Lembaga Keuangan ({data.fundamentals.quarter})
            </h3>
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
              Basis: {data.fundamentals.basis}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pendapatan Bunga Bersih (NII) YoY
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {data.fundamentals.netInterestIncomeGrowth.growthLabel}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pertumbuhan Laba Bersih YoY
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {data.fundamentals.netIncomeGrowth.growthLabel}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Rasio Kredit terhadap Simpanan (LDR)
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {typeof data.fundamentals.loanToDepositRatio === 'number'
                  ? `${(data.fundamentals.loanToDepositRatio * 100).toFixed(1)}%`
                  : 'Data tidak tersedia'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pertumbuhan Kredit (Loans) YoY
              </span>
              <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                {data.fundamentals.loanGrowth?.growthLabel ?? 'Data tidak tersedia'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pertumbuhan DPK (Deposits) YoY
              </span>
              <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                {data.fundamentals.depositGrowth?.growthLabel ?? 'Data tidak tersedia'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Non-Financial Layout */}
      {data?.fundamentals?.group === 'NON_FINANCIAL' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--rasi-text)]">
              Kinerja Bisnis & Arus Kas ({data.fundamentals.quarter})
            </h3>
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
              Basis: {data.fundamentals.basis}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pertumbuhan Pendapatan YoY
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {data.fundamentals.revenueGrowth.growthLabel}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Pertumbuhan Laba Bersih YoY
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {data.fundamentals.netIncomeGrowth.growthLabel}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Margin Laba Bersih (NPM)
              </span>
              <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                {data.fundamentals.netMarginCurrent !== null
                  ? `${(data.fundamentals.netMarginCurrent * 100).toFixed(2)}%`
                  : 'Data tidak tersedia'}
              </span>
              {data.fundamentals.marginChangePoints !== null && (
                <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
                  Perubahan: {data.fundamentals.marginChangePoints >= 0 ? '+' : ''}
                  {data.fundamentals.marginChangePoints} pp vs tahun lalu
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">Arus Kas Operasi (OCF)</span>
              <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                {data.fundamentals.operatingCashFlow !== null
                  ? `Rp ${(data.fundamentals.operatingCashFlow / 1_000_000_000).toFixed(2)} M`
                  : 'Data tidak tersedia'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
              <span className="block text-xs text-[var(--rasi-muted)]">
                Debt to Equity Ratio (DER)
              </span>
              <span className="mt-1 block font-mono text-lg font-bold tabular-nums">
                {data.fundamentals.debtToEquity !== null
                  ? `${data.fundamentals.debtToEquity.toFixed(2)}x`
                  : 'Data tidak tersedia'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Standard P/E & P/B Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--rasi-muted)]">
            <span> Harga dibanding laba (P/E) </span>
            <details className="cursor-pointer">
              <summary className="flex list-none items-center gap-0.5 text-[var(--rasi-primary)] hover:underline">
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="text-[11px]">Apa artinya?</span>
              </summary>
              <p className="mt-2 rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-2 text-xs text-[var(--rasi-text)]">
                {METRIC_EXPLANATIONS.peRatio.detailed}
              </p>
            </details>
          </div>
          <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
            {peVal !== null && peVal !== undefined ? `${peVal.toFixed(1)}x` : 'Data belum cukup'}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            {peVal !== null && peVal !== undefined && peVal > 0 && peVal < 15
              ? 'P/E di bawah 15; bandingkan juga dengan perusahaan sejenis'
              : 'Lihat juga apakah laba perusahaan bertumbuh'}
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--rasi-muted)]">
            <span> Harga dibanding aset bersih (P/B) </span>
            <details className="cursor-pointer">
              <summary className="flex list-none items-center gap-0.5 text-[var(--rasi-primary)] hover:underline">
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="text-[11px]">Apa artinya?</span>
              </summary>
              <p className="mt-2 rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-2 text-xs text-[var(--rasi-text)]">
                {METRIC_EXPLANATIONS.pbRatio.detailed}
              </p>
            </details>
          </div>
          <span className="mt-2 block font-mono text-2xl font-bold tabular-nums">
            {pbVal !== null && pbVal !== undefined ? `${pbVal.toFixed(1)}x` : 'Data belum cukup'}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            Harga dibanding aset setelah dikurangi utang
          </span>
        </div>

        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-4">
          <span className="block text-xs text-[var(--rasi-muted)]">Hasil pemeriksaan keuangan</span>
          <span className="mt-2 block text-base font-bold">
            {getStatusLabel(fundamental.status).label}
          </span>
          <span className="mt-1 block text-xs text-[var(--rasi-muted)]">
            {fundamental.reason || 'Perbandingan harga dan keuangan sudah diperiksa.'}
          </span>
        </div>
      </div>

      {/* Business Exposure & Commodity Mapping (F11) */}
      {data?.businessExposure && (
        <div className="space-y-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rasi-border)] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[var(--rasi-text)]">
                Peta Bisnis & Eksposur Komoditas (F11)
              </h4>
              <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
                {data.businessExposure.summary}
              </p>
            </div>
            {data.businessExposure.concentrationLevel !== 'UNKNOWN' && (
              <span
                className={`rounded px-2.5 py-1 text-xs font-bold ${
                  data.businessExposure.concentrationLevel === 'HIGH'
                    ? 'bg-amber-500/20 text-amber-300'
                    : data.businessExposure.concentrationLevel === 'MODERATE'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                Konsentrasi:{' '}
                {data.businessExposure.concentrationLevel === 'HIGH'
                  ? 'Tinggi'
                  : data.businessExposure.concentrationLevel === 'MODERATE'
                    ? 'Moderat'
                    : 'Terdiversifikasi'}
              </span>
            )}
          </div>

          {/* Revenue Segments List */}
          {data.businessExposure.segments.length > 0 && (
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[var(--rasi-muted)]">
                Rincian Segmen Pendapatan
              </span>
              <div className="space-y-2">
                {data.businessExposure.segments.map((seg, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[var(--rasi-text)]">{seg.name}</span>
                      <span className="font-mono font-bold text-[var(--rasi-text)]">
                        {seg.percentage !== null ? `${seg.percentage}%` : '-'}
                      </span>
                    </div>
                    {seg.percentage !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rasi-surface)]">
                        <div
                          className="h-full bg-[var(--rasi-primary)]"
                          style={{
                            width: `${Math.min(100, Math.max(0, seg.percentage))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commodity Exposures */}
          {data.businessExposure.commodityExposures.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="block text-xs font-semibold text-[var(--rasi-muted)]">
                Keterhubungan Komoditas Terverifikasi
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.businessExposure.commodityExposures.map((exp, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--rasi-text)]">{exp.commodityName}</span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {exp.verificationStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--rasi-muted)]">{exp.relationship}</p>
                    <span className="mt-1 block text-[10px] text-[var(--rasi-muted)]/70">
                      {exp.sourceNote}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
