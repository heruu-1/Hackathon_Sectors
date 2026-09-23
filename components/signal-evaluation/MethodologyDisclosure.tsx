'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle, Clock, ShieldCheck, Database } from 'lucide-react'

export function MethodologyDisclosure() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--rasi-muted-bg)]/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[var(--rasi-primary)]" />
          <span className="text-xs font-semibold text-[var(--rasi-text)]">
            Metodologi Perhitungan, Jadwal Sesi BEI & Keterbatasan Data
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-[var(--rasi-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--rasi-muted)]" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-[var(--border-subtle)] space-y-4 text-xs text-[var(--rasi-muted)] leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--rasi-text)]">
                <Clock className="h-3.5 w-3.5 text-[var(--rasi-primary)]" />
                <span>Jam Sesi Kontinu BEI</span>
              </div>
              <p className="text-[11px]">
                <strong>Senin–Kamis:</strong> Sesi I (09.00–12.00), Sesi II (13.30–15.50 WIB eksklusif).<br />
                <strong>Jumat:</strong> Sesi I (09.00–11.30), Sesi II (14.00–15.50 WIB eksklusif).<br />
                Prapenutupan (15.50–16.00) dan pascapenutupan (16.05–16.15) tidak dihitung dalam bar perdagangan kontinu.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--rasi-text)]">
                <Database className="h-3.5 w-3.5 text-amber-500" />
                <span>Karakteristik Feed Data</span>
              </div>
              <p className="text-[11px]">
                Data intraday 5 menit bersumber dari feed upstream Yahoo Chart dengan keterlambatan resmi bursa ~10 menit. Sistem ini berfungsi sebagai panduan evaluasi skenario risiko, bukan alarm eksekusi pasar langsung.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/20 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--rasi-text)]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Integritas Konteks Server</span>
              </div>
              <p className="text-[11px]">
                Konteks sinyal dibuat immutable di server untuk mencegah manipulasi harga acuan. Harga acuan diambil dari bar penutupan terakhir yang telah selesai saat evaluasi dibuat.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <p>
              • <strong>Aturan Horizon Sesi:</strong> Untuk sinyal yang muncul saat perdagangan berjalan, Horizon 1 adalah akhir sesi kontinu berikutnya (bukan sisa sesi yang sedang berlangsung).
            </p>
            <p>
              • <strong>Model Proyeksi:</strong> Menggunakan simulasi 100.000 lintasan Geometric Brownian Motion (GBM) murni TypeScript dengan drift harga dasar nol. Volatilitas diestimasi terpisah untuk Sesi I, Sesi II, gap makan siang, dan gap semalam.
            </p>
            <p>
              • <strong>Batas Risiko & Trailing Stop:</strong> Stop Loss awal dibekukan berbasis 1,5x ATR Wilder 14 sesi. Ketika target TP1 tercapai, trailing stop dinaikkan secara dinamis untuk melindungi modal.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
