'use client'

import React, { useState } from 'react'
import type { RiskPlan } from '@/lib/contracts/signal-analysis'
import { PositionCalculatorModal } from './PositionCalculatorModal'
import { Button } from '@/components/ui/Button'
import { Calculator, Shield, Target, ArrowUpRight, TrendingUp } from 'lucide-react'

interface RiskPlanCardProps {
  plan: RiskPlan
  ticker: string
}

export function RiskPlanCard({ plan, ticker }: RiskPlanCardProps) {
  const [calculatorOpen, setCalculatorOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-[var(--rasi-text)] uppercase tracking-wider">
            Parameter Manajemen Risiko (Setara Fee & Fraksi IDX)
          </h3>
          <p className="text-[11px] text-[var(--rasi-muted)]">
            Tingkat harga dievaluasi berdasarkan fraksi harga Rp {plan.tick} dan fee transaksi (0,15% beli, 0,25% jual).
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={Calculator}
          onClick={() => setCalculatorOpen(true)}
        >
          Kalkulator Ukuran Lot
        </Button>
      </div>

      {/* Grid of Key Price Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Stop Loss */}
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
            <Shield className="h-3.5 w-3.5" />
            <span>Stop Loss (SL)</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold text-rose-500 tabular-nums">
            Rp {plan.stopLoss.toLocaleString('id-ID')}
          </p>
          <span className="text-[10px] text-[var(--rasi-muted)]">
            Asumsi eksekusi: Rp {plan.assumedStopExecution.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Break Even Price */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>BEP + Slippage</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold text-amber-500 tabular-nums">
            Rp {plan.breakEvenPrice.toLocaleString('id-ID')}
          </p>
          <span className="text-[10px] text-[var(--rasi-muted)]">
            Tutup biaya & proteksi 1 tick
          </span>
        </div>

        {/* Take Profit 1 */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <Target className="h-3.5 w-3.5" />
            <span>Target TP1 (50%)</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold text-emerald-500 tabular-nums">
            Rp {plan.takeProfit1.toLocaleString('id-ID')}
          </p>
          <span className="text-[10px] text-emerald-400 font-semibold">
            RRR Bersih: {plan.rrrTP1}x
          </span>
        </div>

        {/* Take Profit 2 */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Target TP2 (Runner)</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold text-emerald-500 tabular-nums">
            Rp {plan.takeProfit2.toLocaleString('id-ID')}
          </p>
          <span className="text-[10px] text-emerald-400 font-semibold">
            RRR Bersih: {plan.rrrTP2}x
          </span>
        </div>

        {/* Net Risk per Share */}
        <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/30 p-3 text-center sm:text-left">
          <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
            Risiko Bersih (R)
          </span>
          <p className="mt-1 font-mono text-base font-bold text-[var(--rasi-text)] tabular-nums">
            Rp {plan.netRiskPerShare.toLocaleString('id-ID')}
          </p>
          <span className="text-[10px] text-[var(--rasi-muted)]">
            Per lembar saham
          </span>
        </div>

        {/* Initial ATR */}
        <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/30 p-3 text-center sm:text-left">
          <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
            ATR Wilder Awal
          </span>
          <p className="mt-1 font-mono text-base font-bold text-[var(--rasi-text)] tabular-nums">
            {plan.initialATR.toFixed(2)}
          </p>
          <span className="text-[10px] text-[var(--rasi-muted)]">
            Dibekukan saat sinyal
          </span>
        </div>
      </div>

      {/* Assumptions & Trailing Mechanics */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5 text-xs text-[var(--rasi-muted)] space-y-2">
        <div className="font-semibold text-[var(--rasi-text)]">
          Asumsi Eksekusi & Mekanisme Trailing Stop:
        </div>
        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong>Target Profit (TP1 & TP2):</strong> Diasumsikan menggunakan <em>Limit Order</em> pada harga target. Sentuhan harga pada chart tidak otomatis menjamin seluruh order terisi secara penuh di pasar reguler.
          </li>
          <li>
            <strong>Stop Loss & Trailing Stop:</strong> Menggunakan asumsi <em>Market Order</em> dengan estimasi slippage eksekusi {plan.executionAssumptions.slippageTicks} tick di bawah level pemicu.
          </li>
          <li>
            <strong>Trailing Stop Pasca TP1:</strong> Ketika TP1 tercapai, proteksi dinaikkan ke level maksimum antara <code>BEP</code> dan <code>floor(harga penutupan 15m tertinggi − initialATR)</code>. Trailing stop baru hanya aktif setelah bar 15 menit pembentuknya selesai.
          </li>
        </ul>
      </div>

      <PositionCalculatorModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        costBasis={plan.costBasis}
        netRiskPerShare={plan.netRiskPerShare}
        ticker={ticker}
      />
    </div>
  )
}
