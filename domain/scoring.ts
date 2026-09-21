import {
  type BandarmologyIndicator,
  COMPOSITE_WEIGHTS,
  type CompositeScoreResult,
  type DivergenceIndicator,
  type FundamentalIndicator,
  type IndicatorStatus,
  type InsiderIndicator,
  RASI_RULE_VERSION,
} from '../lib/contracts/analysis.ts'
import type { CompanyValuation } from '../lib/contracts/market.ts'

/**
 * Evaluates fundamental valuation ratios (P/E and P/B).
 */
export function evaluateFundamentals(valuation: CompanyValuation | null): FundamentalIndicator {
  if (!valuation || !valuation.historicalValuation || valuation.historicalValuation.length === 0) {
    return {
      dataState: 'empty',
      pe: null,
      pb: null,
      year: null,
      riskScore: null,
      status: 'INSUFFICIENT_DATA',
      reason: 'Data valuasi fundamental tidak tersedia.',
    }
  }

  // Sort by year descending to select the latest valid financial year
  const sorted = [...valuation.historicalValuation]
    .filter((h) => Number.isInteger(h.year))
    .sort((a, b) => b.year - a.year)

  const latest = sorted[0]
  if (!latest || latest.pe === null || latest.pb === null) {
    return {
      dataState: 'partial',
      pe: latest?.pe ?? null,
      pb: latest?.pb ?? null,
      year: latest?.year ?? null,
      riskScore: null,
      status: 'INSUFFICIENT_DATA',
      reason: 'Data P/E dan P/B pada tahun terbaru belum lengkap.',
    }
  }

  const pe = latest.pe
  const pb = latest.pb
  const year = latest.year

  let risk = 40
  const reasons: string[] = []

  if (pe > 40) {
    risk += 25
    reasons.push(`P/E tinggi (${pe.toFixed(2)}x).`)
  } else if (pe < 0) {
    risk += 15
    reasons.push(`P/E negatif (${pe.toFixed(2)}x).`)
  }

  if (pb > 10) {
    risk += 20
    reasons.push(`P/B tinggi (${pb.toFixed(2)}x).`)
  }

  if (reasons.length === 0) {
    risk = 20
    reasons.push('Rasio harga dibanding laba (P/E) dan aset bersih (P/B) berada dalam batas wajar.')
  }

  const status: IndicatorStatus =
    risk > 80 ? 'CRITICAL' : risk > 60 ? 'HIGH' : risk > 40 ? 'WARNING' : 'NORMAL'

  const closeDate = valuation.latestCloseDate ?? 'tidak tersedia'
  reasons.push(
    `Data keuangan tahun ${year}: P/E ${pe.toFixed(2)}x, P/B ${pb.toFixed(2)}x (harga penutupan: ${closeDate}). Perhitungan ini bukan perkiraan universal untuk semua sektor.`,
  )

  return {
    dataState: 'ready',
    pe,
    pb,
    year,
    riskScore: risk,
    status,
    reason: reasons.join(' '),
  }
}

/**
 * Computes composite score across all 4 pillars.
 *
 * CRITICAL RULE:
 * Score is ONLY computed when ALL four components have sufficient, valid data.
 * Missing/incomplete components are NOT replaced with neutral numbers or normalized.
 * If incomplete: score = null, status = 'INSUFFICIENT_DATA'.
 */
export function computeCompositeScore(params: {
  fundamental: FundamentalIndicator
  bandarmology: BandarmologyIndicator
  divergence: DivergenceIndicator
  insider: InsiderIndicator
}): CompositeScoreResult {
  const { fundamental, bandarmology, divergence, insider } = params

  const fundamentalScore = fundamental.riskScore
  const bandarScore = bandarmology.bandarScore
  // Bandar risk is inverted: high accumulation (score 80) -> low risk (20)
  const bandarRisk = bandarScore !== null ? 100 - bandarScore : null

  let divergenceRisk: number | null = null
  if (divergence.status === 'DELAYED_SELL_OFF_RISK') {
    divergenceRisk = 85
  } else if (divergence.status === 'SLEEPING_GIANT') {
    divergenceRisk = 20
  } else if (divergence.status === 'NORMAL_REACTION' || divergence.status === 'NO_CATALYST') {
    divergenceRisk = 50
  } else if (divergence.status === 'PRICED_IN_RALLY') {
    divergenceRisk = 60
  }

  const insiderRisk = insider.insiderRiskScore

  if (
    fundamentalScore === null ||
    bandarRisk === null ||
    divergenceRisk === null ||
    insiderRisk === null
  ) {
    const missing: string[] = []
    if (fundamentalScore === null) missing.push('Fundamental (keuangan perusahaan)')
    if (bandarRisk === null) missing.push('Broker (transaksi)')
    if (divergenceRisk === null) missing.push('Divergensi (berita & perubahan harga)')
    if (insiderRisk === null) missing.push('Orang Dalam (transaksi pengurus)')

    return {
      score: null,
      status: 'INSUFFICIENT_DATA',
      reason: `Skor RASI belum dihitung karena data berikut belum lengkap: ${missing.join(', ')}. Bagian data yang tersedia tetap dapat dibaca secara mandiri.`,
      weights: COMPOSITE_WEIGHTS,
      ruleVersion: RASI_RULE_VERSION,
      componentsComplete: false,
      pillarScores: {
        fundamental: fundamentalScore,
        broker: bandarRisk,
        divergence: divergenceRisk,
        insider: insiderRisk,
      },
    }
  }

  const compositeScore = Math.round(
    fundamentalScore * COMPOSITE_WEIGHTS.fundamental +
      bandarRisk * COMPOSITE_WEIGHTS.broker +
      divergenceRisk * COMPOSITE_WEIGHTS.divergence +
      insiderRisk * COMPOSITE_WEIGHTS.insider,
  )

  let status: CompositeScoreResult['status'] = 'NORMAL'
  if (compositeScore > 75 || insider.status === 'STEEP_DISCOUNT_DUMP') {
    status = 'CRITICAL'
  } else if (compositeScore > 55 || bandarmology.status === 'BIG_DISTRIBUTION') {
    status = 'HIGH'
  } else if (compositeScore > 40) {
    status = 'WARNING'
  }

  const reasons: string[] = []
  if (divergence.status === 'SLEEPING_GIANT') {
    reasons.push('Peluang: Ada berita positif, namun harga saham belum banyak naik.')
  } else if (divergence.status === 'DELAYED_SELL_OFF_RISK') {
    reasons.push('Risiko: Ada berita negatif, namun harga saham belum mengalami penurunan.')
  }

  if (bandarmology.status === 'BIG_ACCUMULATION') {
    reasons.push(
      `Pembelian besar melalui broker utama (3 broker teratas menguasai ${bandarmology.cr3Buy}% pembelian).`,
    )
  } else if (bandarmology.status === 'BIG_DISTRIBUTION') {
    reasons.push(
      `Penjualan besar melalui broker utama (3 broker teratas menguasai ${bandarmology.cr3Sell}% penjualan).`,
    )
  }

  if (insider.status === 'STEEP_DISCOUNT_DUMP') {
    reasons.push(
      'Peringatan: Pengurus atau pemegang saham besar menjual saham jauh di bawah harga pasar.',
    )
  } else if (insider.status === 'AGGRESSIVE_BUY') {
    reasons.push(
      'Pengurus atau pemegang saham besar menambah kepemilikan saham dalam jumlah besar.',
    )
  }

  reasons.push(fundamental.reason)

  return {
    score: compositeScore,
    status,
    reason: reasons.join(' '),
    weights: COMPOSITE_WEIGHTS,
    ruleVersion: RASI_RULE_VERSION,
    componentsComplete: true,
    pillarScores: {
      fundamental: fundamentalScore,
      broker: bandarRisk,
      divergence: divergenceRisk,
      insider: insiderRisk,
    },
  }
}
