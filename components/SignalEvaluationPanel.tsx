'use client'

import React, { useEffect, useState } from 'react'

import { AlertTriangle, Layers, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react'

import { evaluateSignalAnalysisAction, getSignalAnalysisAction } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import type { SignalAnalysisReport } from '@/lib/contracts/signal-analysis'

import { ActualOutcomesTable } from './signal-evaluation/ActualOutcomesTable'
import { MethodologyDisclosure } from './signal-evaluation/MethodologyDisclosure'
import { ProjectionsCard } from './signal-evaluation/ProjectionsCard'
import { RiskPlanCard } from './signal-evaluation/RiskPlanCard'

interface SignalEvaluationPanelProps {
  ticker: string
  companyName?: string
}

export function SignalEvaluationPanel({ ticker, companyName }: SignalEvaluationPanelProps) {
  const cleanTicker = ticker.trim().toUpperCase()

  const [report, setReport] = useState<SignalAnalysisReport | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [evaluating, setEvaluating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'actual' | 'risk' | 'projection'>('actual')

  // Multi-ticker isolation: reset state whenever ticker changes
  useEffect(() => {
    let isMounted = true

    const timer = window.setTimeout(() => {
      if (!isMounted) return
      setReport(null)
      setError(null)
      setLoading(true)

      void getSignalAnalysisAction(cleanTicker)
        .then((res) => {
          if (!isMounted) return
          if (res.ok && res.data) {
            setReport(res.data)
          } else {
            setReport(null)
          }
        })
        .catch(() => {
          if (!isMounted) return
          setReport(null)
        })
        .finally(() => {
          if (!isMounted) return
          setLoading(false)
        })
    }, 0)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [cleanTicker])

  // Trigger new evaluation
  const handleEvaluate = async () => {
    setEvaluating(true)
    setError(null)

    try {
      const requestKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `req-eval-${cleanTicker}-${Date.now()}`

      const res = await evaluateSignalAnalysisAction({
        ticker: cleanTicker,
        requestKey,
      })

      if (res.ok && res.data) {
        setReport(res.data)
      } else if (!res.ok) {
        setError(res.error.message || 'Gagal menjalankan evaluasi sinyal.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat evaluasi.')
    } finally {
      setEvaluating(false)
    }
  }

  // Format ISO to local readable WIB
  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return (
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d) + ' WIB'
      )
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-md">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--rasi-primary)]" />
          <div>
            <h2 className="text-base font-bold text-[var(--rasi-text)]">
              Evaluasi Sinyal, Risiko & Sesi Intraday
            </h2>
            <p className="text-xs text-[var(--rasi-muted)]">
              {cleanTicker} {companyName ? `(${companyName})` : ''} — Evaluasi 1, 3, dan 5 sesi
              perdagangan BEI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            pending={evaluating}
            pendingText="Mengevaluasi…"
            onClick={handleEvaluate}
          >
            {report ? 'Perbarui Evaluasi' : 'Evaluasi Sinyal Terkini'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <div>
            <span className="font-bold">Gagal Mengevaluasi Sinyal:</span> {error}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !report && (
        <div className="space-y-2 py-10 text-center text-xs text-[var(--rasi-muted)]">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--rasi-primary)] border-t-transparent" />
          <p>Memeriksa riwayat evaluasi sinyal tersimpan…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !report && !error && (
        <div className="space-y-3 rounded-xl border border-dashed border-[var(--rasi-border)] px-4 py-10 text-center">
          <Layers className="mx-auto h-8 w-8 text-[var(--rasi-muted)]/50" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--rasi-text)]">
              Belum Ada Evaluasi Sesi untuk {cleanTicker}
            </h3>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--rasi-muted)]">
              Klik &quot;Evaluasi Sinyal Terkini&quot; untuk menjalankan evaluasi hasil 1, 3, dan 5
              sesi perdagangan ke depan, simulasi risiko (SL, TP1, TP2, BEP), dan proyeksi Geometric
              Brownian Motion (GBM).
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleEvaluate} pending={evaluating}>
            Mulai Evaluasi Sekarang
          </Button>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-5">
          {/* 2. Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/30 px-3.5 py-2.5 text-[11px] text-[var(--rasi-muted)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Aturan:{' '}
                <strong className="font-mono text-[var(--rasi-primary)]">
                  {report.context.ruleLabel}
                </strong>
              </span>
              <span>
                Harga acuan:{' '}
                <strong className="font-mono text-[var(--rasi-text)]">
                  Rp {report.context.referencePrice.toLocaleString('id-ID')}
                </strong>{' '}
                ({formatDateTime(report.context.referencePriceAt)})
              </span>
              <span>
                Data as of:{' '}
                <strong className="font-mono text-[var(--rasi-text)]">
                  {formatDateTime(report.asOf)}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                Feed Tertunda ~10m (Yahoo)
              </span>
            </div>
          </div>

          {/* 3. Summary Bar */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Technical Condition */}
            <div className="space-y-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--surface-card)] p-3">
              <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
                Kondisi Teknis:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    report.assessment.condition.includes('BULLISH')
                      ? 'bg-emerald-500'
                      : report.assessment.condition.includes('BEARISH')
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-semibold text-[var(--rasi-text)]">
                  {report.assessment.condition === 'STRONG_BULLISH'
                    ? 'Sangat Kuat (Bullish)'
                    : report.assessment.condition === 'BULLISH'
                      ? 'Positif (Bullish)'
                      : report.assessment.condition === 'BEARISH'
                        ? 'Melemah (Bearish)'
                        : 'Konsolidasi (Netral)'}
                </span>
              </div>
              <p className="line-clamp-1 text-[10px] text-[var(--rasi-muted)]">
                {report.assessment.summary}
              </p>
            </div>

            {/* Price Change */}
            <div className="space-y-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--surface-card)] p-3">
              <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
                Perubahan Terhadap Acuan:
              </span>
              {(() => {
                const latestActual = report.outcomes.find(
                  (o) => o.status === 'MATURED',
                )?.actualPrice
                const ref = report.context.referencePrice
                if (latestActual) {
                  const gross = (latestActual - ref) / ref
                  return (
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-mono text-sm font-bold ${
                          gross >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {gross >= 0 ? '+' : ''}
                        {(gross * 100).toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-[var(--rasi-muted)]">
                        (Rp {latestActual.toLocaleString('id-ID')})
                      </span>
                    </div>
                  )
                }
                return (
                  <p className="font-mono text-xs text-[var(--rasi-muted)]">
                    Menunggu sesi selesai
                  </p>
                )
              })()}
              <p className="text-[10px] text-[var(--rasi-muted)]">Berdasarkan sesi termutakhir</p>
            </div>

            {/* Stop Scenario Status */}
            <div className="space-y-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--surface-card)] p-3">
              <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
                Status Skenario Stop:
              </span>
              <p className="text-xs font-semibold">
                {report.assessment.stopStatus === 'UNTRIGGERED' ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Batas Stop Terjaga (Aman)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Stop Loss Terpicu
                  </span>
                )}
              </p>
              <p className="text-[10px] text-[var(--rasi-muted)]">
                SL awal: Rp {report.riskPlan.stopLoss.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* 4. Three Tabs */}
          <div className="space-y-4">
            <div className="flex border-b border-[var(--border-subtle)] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('actual')}
                className={`border-b-2 px-4 pb-2.5 transition-colors ${
                  activeTab === 'actual'
                    ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                    : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                Hasil Aktual (1, 3, 5 Sesi)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('risk')}
                className={`border-b-2 px-4 pb-2.5 transition-colors ${
                  activeTab === 'risk'
                    ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                    : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                Rencana Risiko & Posisi
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('projection')}
                className={`border-b-2 px-4 pb-2.5 transition-colors ${
                  activeTab === 'projection'
                    ? 'border-[var(--rasi-primary)] text-[var(--rasi-primary)]'
                    : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'
                }`}
              >
                Proyeksi Stokastik (GBM)
              </button>
            </div>

            {/* Tab Contents */}
            <div>
              {activeTab === 'actual' && <ActualOutcomesTable outcomes={report.outcomes} />}

              {activeTab === 'risk' && <RiskPlanCard plan={report.riskPlan} ticker={cleanTicker} />}

              {activeTab === 'projection' && <ProjectionsCard projection={report.projection} />}
            </div>
          </div>

          {/* 5. Disclosure & Guidance */}
          <MethodologyDisclosure />
        </div>
      )}
    </div>
  )
}
