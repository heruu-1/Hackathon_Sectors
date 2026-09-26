'use client'

import React, { useCallback, useEffect, useState } from 'react'

import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  FileText,
  GitCompare,
  Printer,
  Save,
} from 'lucide-react'

import {
  diffSnapshotsAction,
  evaluateSignalOutcomesAction,
  getResearchNotesForTickerAction,
  getSignalOutcomesAction,
  getSnapshotsForTickerAction,
  saveResearchNoteAction,
} from '@/app/actions'
import { Button } from '@/components/ui'
import { SignalEvaluationPanel } from '@/components/SignalEvaluationPanel'
import { type SnapshotDiffResult, generateSnapshotMarkdown } from '@/domain/snapshot-diff'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'

interface ResearchWorkspaceProps {
  ticker: string
  companyName: string
  currentSnapshot: AnalysisSnapshot | null
}

export function ResearchWorkspace({
  ticker,
  companyName,
  currentSnapshot,
}: ResearchWorkspaceProps) {
  // Thesis form state
  const [thesis, setThesis] = useState('')
  const [invalidationTriggers, setInvalidationTriggers] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [savedNotes, setSavedNotes] = useState<
    Array<{
      id: string
      thesis: string
      invalidationTriggers: string | null
      createdAt: Date | string
    }>
  >([])

  // Snapshots & Diff state
  const [snapshots, setSnapshots] = useState<
    Array<{ id: string; createdAt: Date | string; marketCutoffDate: string }>
  >([])
  const [selectedSnapshotA, setSelectedSnapshotA] = useState<string>('')
  const [selectedSnapshotB, setSelectedSnapshotB] = useState<string>('')
  const [diffResult, setDiffResult] = useState<SnapshotDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState('')

  // Markdown copy state
  const [copied, setCopied] = useState(false)

  // Signal Outcomes state (E01, E02)
  const [outcomes, setOutcomes] = useState<
    Array<{
      id: number
      ruleId: string
      horizon: number
      signalDate: string
      targetDate: string | null
      initialPrice: number | null
      targetPrice: number | null
      returnFraction: number | null
      status: string
    }>
  >([])
  const [evaluatingOutcomes, setEvaluatingOutcomes] = useState(false)

  // Load existing notes, snapshots, and outcomes
  const loadNotesAndSnapshots = useCallback(async () => {
    try {
      const [notesRes, snapsRes, outcomesRes] = await Promise.all([
        getResearchNotesForTickerAction(ticker),
        getSnapshotsForTickerAction(ticker),
        getSignalOutcomesAction(ticker),
      ])

      if (notesRes.success && notesRes.data) {
        setSavedNotes(notesRes.data as unknown as typeof savedNotes)
        if (notesRes.data.length > 0) {
          const latest = notesRes.data[0]
          setThesis(latest.thesis)
          setInvalidationTriggers(latest.invalidationTriggers ?? '')
        }
      }

      if (snapsRes.success && snapsRes.data) {
        setSnapshots(snapsRes.data as unknown as typeof snapshots)
        if (snapsRes.data.length >= 2) {
          setSelectedSnapshotA(snapsRes.data[1].id)
          setSelectedSnapshotB(snapsRes.data[0].id)
        } else if (snapsRes.data.length === 1) {
          setSelectedSnapshotB(snapsRes.data[0].id)
        }
      }

      if (outcomesRes.success && outcomesRes.data) {
        setOutcomes(outcomesRes.data as unknown as typeof outcomes)
      }
    } catch {
      // Fallback
    }
  }, [ticker])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!isMounted) return
      void loadNotesAndSnapshots()
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [loadNotesAndSnapshots])

  // Evaluate outcomes for current snapshot
  const handleEvaluateOutcomes = async () => {
    if (!currentSnapshot) return
    setEvaluatingOutcomes(true)

    const signalDate = currentSnapshot.priceDate ?? currentSnapshot.createdAt.split('T')[0]
    const initialPrice = currentSnapshot.price
    const ruleId = currentSnapshot.composite.status !== 'NORMAL' ? 'R01' : 'GENERAL'

    const res = await evaluateSignalOutcomesAction(
      ticker,
      currentSnapshot.id,
      ruleId,
      signalDate,
      initialPrice,
    )

    setEvaluatingOutcomes(false)
    if (res.success && res.data) {
      setOutcomes(res.data as unknown as typeof outcomes)
    }
  }

  // Save thesis
  const handleSaveThesis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!thesis.trim()) return

    setSaveLoading(true)
    setSaveMessage('')

    const snapshotId = currentSnapshot?.id || selectedSnapshotB || 'default-snap'
    const res = await saveResearchNoteAction(
      ticker,
      snapshotId,
      thesis.trim(),
      invalidationTriggers.trim() || undefined,
    )

    setSaveLoading(false)

    if (res.success) {
      setSaveMessage('Tesis riset berhasil disimpan.')
      void loadNotesAndSnapshots()
    } else {
      setSaveMessage(res.error ?? 'Gagal menyimpan tesis riset.')
    }
  }

  // Run diff
  const handleRunDiff = async () => {
    if (!selectedSnapshotA || !selectedSnapshotB) return
    setDiffLoading(true)
    setDiffError('')

    const res = await diffSnapshotsAction(selectedSnapshotA, selectedSnapshotB)
    setDiffLoading(false)

    if (res.success && res.data) {
      setDiffResult(res.data)
    } else {
      setDiffError(res.error ?? 'Gagal membandingkan snapshot.')
    }
  }

  // Copy markdown
  const handleCopyMarkdown = () => {
    if (!currentSnapshot) return
    const md = generateSnapshotMarkdown(
      currentSnapshot,
      thesis.trim() || undefined,
      invalidationTriggers.trim() || undefined,
    )
    void navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Print brief
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* 1. Thesis & Invalidation Triggers */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--rasi-card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--rasi-primary)]" />
            <h2 className="text-base font-bold text-[var(--rasi-text)]">
              Tesis Riset & Batas Pembatalan: {ticker} ({companyName})
            </h2>
          </div>
          <span className="text-xs text-[var(--rasi-muted)]">F12 Ruang Riset</span>
        </div>

        <form onSubmit={handleSaveThesis} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="thesis-input"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Tesis Investasi / Hipotesis Pasar
            </label>
            <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
              Tuliskan alasan mengapa emiten ini layak diperhatikan (misal: pertumbuhan laba, arus
              broker asing, atau valuasi diskon).
            </p>
            <textarea
              id="thesis-input"
              rows={3}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="Contoh: Valuasi P/E 8x di bawah rata-rata industri 14x didukung pertumbuhan laba bersih >25% YoY dan konsistensi akumulasi broker asing."
              className="mt-1.5 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>

          <div>
            <label
              htmlFor="invalidation-input"
              className="block text-xs font-semibold text-[var(--rasi-muted)]"
            >
              Pemicu Pembatalan Tesis (Invalidation Triggers)
            </label>
            <p className="mt-0.5 text-xs text-[var(--rasi-muted)]">
              Kondisi spesifik yang jika terjadi menandakan bahwa tesis Anda telah keliru atau tidak
              berlaku lagi.
            </p>
            <textarea
              id="invalidation-input"
              rows={2}
              value={invalidationTriggers}
              onChange={(e) => setInvalidationTriggers(e.target.value)}
              placeholder="Contoh: Laba kuartalan terkontraksi >10%, arus asing berbalik distribusi 5 sesi berturut-turut, atau harga tembus di bawah support Rp 9.200."
              className="mt-1.5 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
            />
          </div>

          {saveMessage && (
            <div
              className={`rounded-lg p-3 text-xs ${
                saveMessage.includes('berhasil')
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-[#072418] dark:text-emerald-200'
                  : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200'
              }`}
            >
              {saveMessage}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Save}
              disabled={saveLoading || !thesis.trim()}
            >
              {saveLoading ? 'Menyimpan…' : 'Simpan Tesis'}
            </Button>
          </div>
        </form>

        {/* Previous notes history */}
        {savedNotes.length > 1 && (
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-xs font-semibold text-[var(--rasi-muted)]">
              Riwayat Catatan Sebelumnya ({savedNotes.length})
            </h3>
            <div className="mt-2 space-y-2">
              {savedNotes.slice(1, 4).map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/40 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-[var(--rasi-muted)]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(note.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[var(--rasi-text)]">{note.thesis}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Snapshot Diff Viewer */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--rasi-card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-[var(--rasi-primary)]" />
            <h2 className="text-base font-bold text-[var(--rasi-text)]">
              Perbandingan Antar Snapshot (Snapshot Diff)
            </h2>
          </div>
          <span className="text-xs text-[var(--rasi-muted)]">Evaluasi Dinamis</span>
        </div>

        {snapshots.length < 2 ? (
          <div className="py-6 text-center text-xs text-[var(--rasi-muted)]">
            Dibutuhkan minimal 2 snapshot riwayat riset untuk melakukan perbandingan. Snapshot
            dibuat otomatis saat emiten dianalisis.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--rasi-muted)]">
                  Snapshot Awal (Baseline)
                </label>
                <select
                  value={selectedSnapshotA}
                  onChange={(e) => setSelectedSnapshotA(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-2 text-xs text-[var(--rasi-text)]"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ({s.marketCutoffDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--rasi-muted)]">
                  Snapshot Akhir (Tinjauan)
                </label>
                <select
                  value={selectedSnapshotB}
                  onChange={(e) => setSelectedSnapshotB(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-3 py-2 text-xs text-[var(--rasi-text)]"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ({s.marketCutoffDate})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={GitCompare}
              onClick={handleRunDiff}
              disabled={diffLoading || selectedSnapshotA === selectedSnapshotB}
            >
              {diffLoading ? 'Membandingkan…' : 'Bandingkan Kedua Snapshot'}
            </Button>

            {diffError && <p className="text-xs text-rose-500">{diffError}</p>}

            {/* Diff Results Presentation */}
            {diffResult && (
              <div className="mt-4 space-y-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface-2)] p-4 shadow-[var(--rasi-card-shadow)]">
                <div className="flex items-center justify-between border-b border-[var(--rasi-border)] pb-2">
                  <span className="text-xs font-bold text-[var(--rasi-text)]">
                    Hasil Perbandingan: {diffResult.dateEarlier} → {diffResult.dateLater}
                  </span>
                  <span className="font-mono text-xs text-[var(--rasi-muted)]">
                    {diffResult.ticker}
                  </span>
                </div>

                {/* Metric Delta Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                    <span className="block text-[11px] text-[var(--rasi-muted)]">
                      Perubahan Harga
                    </span>
                    <div className="mt-1 flex items-center gap-1 font-mono text-sm font-bold">
                      {diffResult.priceDiff.percentageChange !== null ? (
                        <>
                          {diffResult.priceDiff.percentageChange >= 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-rose-500" />
                          )}
                          <span
                            className={
                              diffResult.priceDiff.percentageChange >= 0
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                            }
                          >
                            {diffResult.priceDiff.percentageChange >= 0 ? '+' : ''}
                            {diffResult.priceDiff.percentageChange}%
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                    <span className="block text-[11px] text-[var(--rasi-muted)]">
                      Delta Skor Komposit
                    </span>
                    <div className="mt-1 flex items-center gap-1 font-mono text-sm font-bold">
                      <span
                        className={
                          diffResult.scoreDiff.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }
                      >
                        {diffResult.scoreDiff.delta >= 0 ? '+' : ''}
                        {diffResult.scoreDiff.delta} poin
                      </span>
                      <span className="text-[10px] text-[var(--rasi-muted)]">
                        ({diffResult.scoreDiff.earlier} → {diffResult.scoreDiff.later})
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 sm:col-span-1">
                    <span className="block text-[11px] text-[var(--rasi-muted)]">Sinyal Baru</span>
                    <span className="mt-1 block font-mono text-sm font-bold text-[var(--rasi-text)]">
                      {diffResult.rulesChanges.newlyTriggered.length} terdeteksi
                    </span>
                  </div>
                </div>

                {/* Rules Delta Badges */}
                <div className="space-y-2">
                  {diffResult.rulesChanges.newlyTriggered.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-500">
                        Sinyal Baru Muncul:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {diffResult.rulesChanges.newlyTriggered.map((rule) => (
                          <span
                            key={rule}
                            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400"
                          >
                            + {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {diffResult.rulesChanges.resolved.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-[var(--rasi-muted)]">
                        Sinyal Terselesaikan:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {diffResult.rulesChanges.resolved.map((rule) => (
                          <span
                            key={rule}
                            className="rounded border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2 py-0.5 text-[11px] text-[var(--rasi-muted)] line-through"
                          >
                            {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-xs leading-relaxed text-[var(--rasi-text)]">
                  {diffResult.summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Dynamic Signal Evaluation, Risk & Projections (E01 Intraday Sessions) */}
      <SignalEvaluationPanel ticker={ticker} companyName={companyName} />

      {/* 3b. Legacy Evaluation Archive (Daily Trading Days Based) */}
      <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--rasi-card-shadow)] group">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--rasi-muted)] hover:text-[var(--rasi-text)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--rasi-muted)]" />
            <span>Evaluasi lama — berbasis hari bursa (Legacy)</span>
          </div>
          <span className="text-[11px] text-[var(--rasi-muted)] group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>

        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--rasi-muted)] leading-relaxed">
              Data di bawah ini dihitung dari deret harga harian (hari bursa), sebelum adopsi sistem sesi intraday BEI (Sesi I dan Sesi II).
            </p>
            {currentSnapshot && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEvaluateOutcomes}
                disabled={evaluatingOutcomes}
              >
                {evaluatingOutcomes ? 'Mengevaluasi...' : 'Hitung Evaluasi Harian'}
              </Button>
            )}
          </div>

          {outcomes.length === 0 ? (
            <div className="py-4 text-center text-xs text-[var(--rasi-muted)]">
              Tidak ada data evaluasi harian lama.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] font-semibold text-[var(--rasi-muted)]">
                  <tr>
                    <th scope="col" className="px-3 py-2">Aturan</th>
                    <th scope="col" className="px-3 py-2">Tgl Sinyal</th>
                    <th scope="col" className="px-3 py-2 text-right">Harga Awal</th>
                    <th scope="col" className="px-3 py-2 text-center">Horizon</th>
                    <th scope="col" className="px-3 py-2">Tgl Target</th>
                    <th scope="col" className="px-3 py-2 text-right">Harga aktual akhir horizon</th>
                    <th scope="col" className="px-3 py-2 text-right">Return Hari</th>
                    <th scope="col" className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rasi-border)] text-[var(--rasi-text)]">
                  {outcomes.map((o) => (
                    <tr key={`${o.id}-${o.horizon}`} className="hover:bg-[var(--rasi-muted-bg)]/30">
                      <td className="px-3 py-2 font-mono font-bold text-[var(--rasi-primary)]">
                        {o.ruleId}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--rasi-muted)]">
                        {o.signalDate}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {o.initialPrice !== null
                          ? `Rp ${o.initialPrice.toLocaleString('id-ID')}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-semibold">
                        {o.horizon} Hari
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--rasi-muted)]">
                        {o.targetDate ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {o.targetPrice !== null
                          ? `Rp ${o.targetPrice.toLocaleString('id-ID')}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                        {o.returnFraction !== null ? (
                          <span
                            className={o.returnFraction >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                          >
                            {o.returnFraction >= 0 ? '+' : ''}
                            {(o.returnFraction * 100).toFixed(2)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            o.status === 'MATURED'
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : o.status === 'PENDING'
                                ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                                : 'border border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* 4. Export & Printable Brief */}
      {currentSnapshot && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--rasi-card-shadow)] print:border-none print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--rasi-primary)]" />
              <h2 className="text-base font-bold text-[var(--rasi-text)]">
                Brief Riset & Ekspor Markdown
              </h2>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopyMarkdown}
              >
                {copied ? 'Tersalin!' : 'Salin Markdown'}
              </Button>
              <Button variant="secondary" size="sm" icon={Printer} onClick={handlePrint}>
                Cetak / PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--rasi-muted-bg)]/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--rasi-text)] select-all">
            {generateSnapshotMarkdown(
              currentSnapshot,
              thesis.trim() || undefined,
              invalidationTriggers.trim() || undefined,
            )}
          </div>
        </div>
      )}
    </div>
  )
}
