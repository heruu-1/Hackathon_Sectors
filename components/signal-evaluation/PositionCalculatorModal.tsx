'use client'

import React, { useState } from 'react'

import { Calculator } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { calculatePositionSize } from '@/domain/trade-risk'

interface PositionCalculatorModalProps {
  open: boolean
  onClose: () => void
  costBasis: number
  netRiskPerShare: number
  ticker: string
}

export function PositionCalculatorModal({
  open,
  onClose,
  costBasis,
  netRiskPerShare,
  ticker,
}: PositionCalculatorModalProps) {
  const [capitalInput, setCapitalInput] = useState<string>('')
  const [cashInput, setCashInput] = useState<string>('')
  const [riskPct, setRiskPct] = useState<number>(0.5) // default 0.5%

  const capital = parseFloat(capitalInput.replace(/\D/g, '')) || 0
  const availableCash = cashInput.trim()
    ? parseFloat(cashInput.replace(/\D/g, '')) || capital
    : capital

  const sizing = calculatePositionSize({
    capital,
    availableCash,
    costBasis,
    netRiskPerShare,
    maxRiskFraction: riskPct / 100,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Kalkulator Posisi & Risiko: ${ticker}`}
      description="Kalkulator ukuran lot berbasis batas toleransi risiko modal bersih setelah memperhitungkan biaya dan fraksi harga BEI."
      maxWidth="md"
      role="form"
    >
      <div className="space-y-5 pt-2 text-xs text-[var(--rasi-text)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold text-[var(--rasi-muted)]">
              Total Modal Portofolio (Rp)
            </label>
            <input
              type="text"
              placeholder="Contoh: 100.000.000"
              value={
                capitalInput ? Number(capitalInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''
              }
              onChange={(e) => setCapitalInput(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-2 font-mono text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[var(--rasi-muted)]">
              Kas Tersedia (Rp, Opsional)
            </label>
            <input
              type="text"
              placeholder="Kosongkan jika sama dengan total modal"
              value={cashInput ? Number(cashInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={(e) => setCashInput(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-2 font-mono text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="font-semibold text-[var(--rasi-muted)]">
              Batas Toleransi Risiko per Transaksi
            </label>
            <span className="font-mono font-bold text-[var(--rasi-primary)]">
              {riskPct.toFixed(1)}% (
              {capital > 0 ? `Rp ${(capital * (riskPct / 100)).toLocaleString('id-ID')}` : 'Rp 0'})
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {[0.25, 0.5, 1.0, 1.5, 2.0].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRiskPct(preset)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  riskPct === preset
                    ? 'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)]'
                    : 'border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Result Card */}
        <div className="space-y-3 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/40 p-4">
          <div className="flex items-center justify-between border-b border-[var(--rasi-border)] pb-2.5">
            <span className="flex items-center gap-1.5 font-semibold">
              <Calculator className="h-4 w-4 text-[var(--rasi-primary)]" />
              Rekomendasi Ukuran Posisi:
            </span>
            <span className="font-mono text-base font-bold text-[var(--rasi-primary)]">
              {sizing.totalLots.toLocaleString('id-ID')} Lot
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-[var(--rasi-muted)]">Alokasi TP1 (Target RRR ≥ 1,25):</span>
              <p className="mt-0.5 font-mono font-semibold text-[var(--rasi-text)]">
                {sizing.tp1Lots} Lot (50% posisi)
              </p>
            </div>
            <div>
              <span className="text-[var(--rasi-muted)]">Alokasi TP2 / Trailing:</span>
              <p className="mt-0.5 font-mono font-semibold text-[var(--rasi-text)]">
                {sizing.tp2Lots} Lot (50% posisi)
              </p>
            </div>
            <div>
              <span className="text-[var(--rasi-muted)]">Modal Beli Dibutuhkan:</span>
              <p className="mt-0.5 font-mono font-semibold text-[var(--rasi-text)]">
                Rp {sizing.totalCapitalRequired.toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <span className="text-[var(--rasi-muted)]">Maksimal Risiko Terpasang:</span>
              <p className="mt-0.5 font-mono font-bold text-rose-400">
                Rp {sizing.totalRiskAllocated.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-[11px] text-[var(--rasi-muted)]">
          <p>
            • <strong>Biaya per saham:</strong> Rp {costBasis.toLocaleString('id-ID')} (sudah
            termasuk fee beli 0,15%).
          </p>
          <p>
            • <strong>Risiko bersih per saham (R):</strong> Rp{' '}
            {netRiskPerShare.toLocaleString('id-ID')} (memperhitungkan asumsi slippage stop 1 tick
            dan fee jual 0,25%).
          </p>
          <p>
            • <strong>Aturan lot ganjil:</strong> Jika total lot ganjil, porsi TP1 dialokasikan{' '}
            <code>floor(lots/2)</code>. Jika hanya 1 lot, 100% diposisikan untuk ditutup pada TP1.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Tutup Kalkulator
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
