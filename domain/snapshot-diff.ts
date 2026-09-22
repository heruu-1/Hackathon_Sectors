/**
 * Domain module for research snapshot diffing, deterministic briefs,
 * and assistant prompt context generation (F12).
 */
import type { AnalysisSnapshot } from '../lib/contracts/analysis.ts'

export interface SnapshotDiffResult {
  ticker: string
  dateEarlier: string
  dateLater: string
  priceDiff: {
    earlier: number | null
    later: number | null
    nominalChange: number | null
    percentageChange: number | null
  }
  scoreDiff: {
    earlier: number
    later: number
    delta: number
  }
  rulesChanges: {
    newlyTriggered: string[]
    resolved: string[]
    persistent: string[]
  }
  summary: string
}

/**
 * Computes difference between two snapshots of the same stock across different dates.
 */
export function diffSnapshots(
  snapshotA: AnalysisSnapshot,
  snapshotB: AnalysisSnapshot,
): SnapshotDiffResult {
  // Sort so earlier is first
  const dateA = new Date(snapshotA.createdAt).getTime()
  const dateB = new Date(snapshotB.createdAt).getTime()

  const [earlier, later] = dateA <= dateB ? [snapshotA, snapshotB] : [snapshotB, snapshotA]

  const pEarlier = earlier.price
  const pLater = later.price

  const nominalPriceChange = pEarlier !== null && pLater !== null ? pLater - pEarlier : null
  const percentagePriceChange =
    pEarlier !== null && pLater !== null && pEarlier > 0
      ? Number((((pLater - pEarlier) / pEarlier) * 100).toFixed(2))
      : null

  const scoreEarlier = earlier.composite.score ?? 0
  const scoreLater = later.composite.score ?? 0
  const scoreDelta = scoreLater - scoreEarlier

  // Compare rule triggers
  const getTriggeredRules = (s: AnalysisSnapshot): Set<string> => {
    const rules = new Set<string>()
    if (
      s.indicators.fundamental.status !== 'NORMAL' &&
      s.indicators.fundamental.status !== 'UNKNOWN'
    ) {
      rules.add(`Fundamental: ${s.indicators.fundamental.status}`)
    }
    if (
      s.indicators.bandarmology.status !== 'NEUTRAL' &&
      s.indicators.bandarmology.status !== 'INSUFFICIENT_DATA'
    ) {
      rules.add(`Transaksi: ${s.indicators.bandarmology.status}`)
    }
    if (
      s.indicators.divergence.status !== 'NORMAL_REACTION' &&
      s.indicators.divergence.status !== 'NO_CATALYST' &&
      s.indicators.divergence.status !== 'INSUFFICIENT_DATA'
    ) {
      rules.add(`Katalis: ${s.indicators.divergence.status}`)
    }
    if (s.indicators.volume.status === 'EXTREME' || s.indicators.volume.status === 'HIGH') {
      rules.add('R04: Volume Spike')
    }
    return rules
  }

  const rulesEarlier = getTriggeredRules(earlier)
  const rulesLater = getTriggeredRules(later)

  const newlyTriggered: string[] = []
  const resolved: string[] = []
  const persistent: string[] = []

  for (const r of rulesLater) {
    if (rulesEarlier.has(r)) {
      persistent.push(r)
    } else {
      newlyTriggered.push(r)
    }
  }

  for (const r of rulesEarlier) {
    if (!rulesLater.has(r)) {
      resolved.push(r)
    }
  }

  const dateEarlierStr = earlier.priceDate ?? earlier.createdAt.split('T')[0]
  const dateLaterStr = later.priceDate ?? later.createdAt.split('T')[0]

  const summary = `Perubahan ${earlier.ticker} dari ${dateEarlierStr} ke ${dateLaterStr}: Harga ${percentagePriceChange !== null ? (percentagePriceChange >= 0 ? '+' : '') + percentagePriceChange + '%' : 'stabil'}, Skor komposit ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} poin (${scoreEarlier} → ${scoreLater}). ${newlyTriggered.length > 0 ? `Sinyal baru terdeteksi: ${newlyTriggered.join(', ')}.` : 'Tidak ada sinyal baru.'}`

  return {
    ticker: earlier.ticker,
    dateEarlier: dateEarlierStr,
    dateLater: dateLaterStr,
    priceDiff: {
      earlier: pEarlier,
      later: pLater,
      nominalChange: nominalPriceChange,
      percentageChange: percentagePriceChange,
    },
    scoreDiff: {
      earlier: scoreEarlier,
      later: scoreLater,
      delta: scoreDelta,
    },
    rulesChanges: {
      newlyTriggered,
      resolved,
      persistent,
    },
    summary,
  }
}

/**
 * Generates structured Markdown text of the research snapshot (F12 deterministic export).
 */
export function generateSnapshotMarkdown(
  snapshot: AnalysisSnapshot,
  personalThesis?: string,
  invalidationTrigger?: string,
): string {
  const snapshotDate = snapshot.priceDate ?? snapshot.createdAt.split('T')[0]
  const lines: string[] = [
    `# Brief Riset Pasar: ${snapshot.ticker} (${snapshot.companyName})`,
    `Tanggal Snapshot: ${snapshotDate}`,
    `Versi Aturan: ${snapshot.ruleVersion}`,
    '',
    '## 1. Ringkasan Harga & Skor',
    `- Harga Penutupan Terakhir: Rp ${snapshot.price?.toLocaleString('id-ID') ?? 'N/A'}`,
    `- Perubahan Harian: ${snapshot.priceChangeFraction ? (snapshot.priceChangeFraction * 100).toFixed(2) + '%' : '0.00%'}`,
    `- Skor Komposit: ${snapshot.composite.score ?? 'N/A'} / 100 (${snapshot.composite.status})`,
    `- Kesimpulan: ${snapshot.composite.reason}`,
    '',
    '## 2. Pemeriksaan Indikator',
    `- Fundamental: ${snapshot.indicators.fundamental.status} (${snapshot.indicators.fundamental.reason || 'Sesuai'})`,
    `- Transaksi & Broker: ${snapshot.indicators.bandarmology.status} (${snapshot.indicators.bandarmology.flowSummary || 'Seimbang'})`,
    `- Respon Berita: ${snapshot.indicators.divergence.status} (${snapshot.indicators.divergence.verdict || 'Netral'})`,
    `- Aktivitas Volume: ${snapshot.indicators.volume.status === 'EXTREME' || snapshot.indicators.volume.status === 'HIGH' ? `Lonjakan ${snapshot.indicators.volume.formattedRatio} (RVol >= 2.0x)` : 'Volume Normal'}`,
    '',
  ]

  if (personalThesis) {
    lines.push('## 3. Tesis Riset Pribadi')
    lines.push(personalThesis)
    lines.push('')
  }

  if (invalidationTrigger) {
    lines.push('## 4. Kondisi Pembatalan (Invalidation Trigger)')
    lines.push(invalidationTrigger)
    lines.push('')
  }

  lines.push('---')
  lines.push(
    '*Catatan: Analisis ini disintesis secara deterministik oleh RASI Market Intelligence tanpa rekomendasi beli/jual personal.*',
  )

  return lines.join('\n')
}

/**
 * Generates a compact markdown snapshot context for injection into the AI assistant prompt (D09).
 * Enables the assistant to explain existing snapshot findings without consuming additional Sectors credits.
 */
export function generateAssistantSnapshotContext(snapshot: AnalysisSnapshot): string {
  const snapshotDate = snapshot.priceDate ?? snapshot.createdAt.split('T')[0]
  return `
[KONTEKS SNAPSHOT RISET TERVERIFIKASI RASI]
Emiten: ${snapshot.ticker} (${snapshot.companyName})
Tanggal Data: ${snapshotDate}
Harga Terakhir: Rp ${snapshot.price?.toLocaleString('id-ID') ?? 'N/A'} (${snapshot.priceChangeFraction ? (snapshot.priceChangeFraction * 100).toFixed(2) + '%' : '0%'})
Skor Komposit RASI: ${snapshot.composite.score ?? 'N/A'}/100 (${snapshot.composite.status}) - ${snapshot.composite.reason}
Pemeriksaan Bukti:
- Fundamental: ${snapshot.indicators.fundamental.status} (P/E: ${snapshot.indicators.fundamental.pe?.toFixed(1) ?? 'N/A'}x, P/B: ${snapshot.indicators.fundamental.pb?.toFixed(1) ?? 'N/A'}x)
- Transaksi Broker: ${snapshot.indicators.bandarmology.status} (Top 3 Buy: ${snapshot.indicators.bandarmology.cr3Buy?.toFixed(1) ?? 'N/A'}%)
- Respon Berita/Katalis: ${snapshot.indicators.divergence.status} (Sentimen: ${snapshot.indicators.divergence.sentiment ?? 'N/A'})
- Volume Perdagangan: ${snapshot.indicators.volume.status === 'EXTREME' || snapshot.indicators.volume.status === 'HIGH' ? 'Spike Terdeteksi' : 'Normal'} (RVol: ${snapshot.indicators.volume.formattedRatio})
[Gunakan fakta-fakta di atas untuk menjawab pertanyaan pengguna secara obyektif tanpa mengulang request data baru ke provider.]
`.trim()
}
