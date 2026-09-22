/**
 * Domain module for stock ownership, free float, investor composition,
 * monthly shifts, and insider filing integration.
 */
import type { InsiderFilingRow, InsiderMovementAnalysis } from '../lib/insider.ts'
import { analyzeInsiderMovement } from '../lib/insider.ts'
import { normalizeTicker } from './ticker.ts'

export interface ShareholderEntry {
  name: string
  shares: number | null
  percentage: number | null // 0 - 100
  isController?: boolean
}

export interface InvestorCategoryItem {
  code: string // e.g. 'ID' (Individu), 'CP' (Korporasi), 'MF' (Reksa Dana), 'IS' (Asuransi), 'PF' (Dana Pensiun), 'OT' (Lainnya)
  name: string
  localShares: number | null
  localPct: number | null
  foreignShares: number | null
  foreignPct: number | null
  totalPct: number | null
}

export interface MonthlyOwnershipReport {
  period: string // e.g. "2024-08" or "Agustus 2024"
  totalShareholders: number | null
  totalShares: number | null
  scriptlessShares: number | null
  freeFloatPct: number | null // 0 - 100
  localPct: number | null
  foreignPct: number | null
  categories?: InvestorCategoryItem[]
}

export interface OwnershipShiftAnalysis {
  currentPeriod: string
  previousPeriod: string | null
  localShiftPoints: number | null // delta in percentage points
  foreignShiftPoints: number | null // delta in percentage points
  shareholderCountDiff: number | null // delta in number of investors
  freeFloatShiftPoints: number | null
  summary: string
}

export interface OwnershipAnalysisResult {
  symbol: string
  topShareholders: ShareholderEntry[]
  totalControllingPct: number | null
  freeFloat: {
    percentage: number | null
    shares: number | null
    definition: string
    isAnomaly: boolean
  }
  currentComposition: {
    period: string
    localPct: number | null
    foreignPct: number | null
    categories: InvestorCategoryItem[]
  } | null
  shift: OwnershipShiftAnalysis | null
  insiderMovement: InsiderMovementAnalysis | null
}

/**
 * Normalizes an ownership percentage, flagging anomalies (> 100% or < 0%).
 */
export function normalizeOwnershipPercentage(pct: number | null | undefined): {
  value: number | null
  isAnomaly: boolean
} {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return { value: null, isAnomaly: false }
  }
  if (pct < 0 || pct > 100) {
    return { value: pct, isAnomaly: true }
  }
  return { value: Number(pct.toFixed(2)), isAnomaly: false }
}

/**
 * Calculates shift between two periods in percentage points (pp).
 */
export function calculatePercentagePointShift(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null
  }
  return Number((current - previous).toFixed(2))
}

/**
 * Analyzes monthly ownership reports, comparing the latest two available months.
 */
export function analyzeMonthlyOwnership(
  reports: MonthlyOwnershipReport[],
): OwnershipShiftAnalysis | null {
  if (!reports || reports.length === 0) {
    return null
  }

  const current = reports[0]
  if (reports.length < 2) {
    return {
      currentPeriod: current.period,
      previousPeriod: null,
      localShiftPoints: null,
      foreignShiftPoints: null,
      shareholderCountDiff: null,
      freeFloatShiftPoints: null,
      summary: `Data kepemilikan tersedia untuk periode ${current.period}. Diperlukan minimal 2 periode untuk melihat pergeseran antarbulan.`,
    }
  }

  const previous = reports[1]

  const localShift = calculatePercentagePointShift(current.localPct, previous.localPct)
  const foreignShift = calculatePercentagePointShift(current.foreignPct, previous.foreignPct)
  const freeFloatShift = calculatePercentagePointShift(current.freeFloatPct, previous.freeFloatPct)

  const shareholderCountDiff =
    current.totalShareholders !== null &&
    current.totalShareholders !== undefined &&
    previous.totalShareholders !== null &&
    previous.totalShareholders !== undefined
      ? current.totalShareholders - previous.totalShareholders
      : null

  const parts: string[] = []

  if (localShift !== null && foreignShift !== null) {
    if (localShift > 0.5) {
      parts.push(
        `Porsi investor lokal bertambah +${localShift} pp (porsi asing menyusut ${foreignShift} pp).`,
      )
    } else if (localShift < -0.5) {
      parts.push(
        `Porsi investor asing bertambah +${Math.abs(foreignShift ?? 0)} pp (porsi lokal menyusut ${localShift} pp).`,
      )
    } else {
      parts.push(`Komposisi lokal vs asing relatif stabil (pergeseran < 0.5 pp).`)
    }
  }

  if (shareholderCountDiff !== null) {
    const sign = shareholderCountDiff >= 0 ? '+' : ''
    const action = shareholderCountDiff >= 0 ? 'bertambah' : 'berkurang'
    parts.push(
      `Jumlah pemegang saham ${action} ${sign}${shareholderCountDiff.toLocaleString('id-ID')} investor.`,
    )
  }

  return {
    currentPeriod: current.period,
    previousPeriod: previous.period,
    localShiftPoints: localShift,
    foreignShiftPoints: foreignShift,
    shareholderCountDiff,
    freeFloatShiftPoints: freeFloatShift,
    summary: parts.join(' ') || 'Tidak ada perubahan signifikan pada komposisi pemegang saham.',
  }
}

/**
 * Performs full ownership analysis integrating top holders, float, monthly shifts, and insider filings.
 */
export function analyzeOwnership(
  symbol: string,
  topShareholders: ShareholderEntry[] = [],
  monthlyReports: MonthlyOwnershipReport[] = [],
  insiderFilings: InsiderFilingRow[] = [],
  currentMarketPrice: number | null = null,
): OwnershipAnalysisResult {
  const cleanSymbol = normalizeTicker(symbol)

  // Top shareholders analysis
  let totalControllingPct: number | null = null
  if (topShareholders.length > 0) {
    const sum = topShareholders
      .filter((s) => s.isController ?? false)
      .reduce((acc, s) => acc + (s.percentage ?? 0), 0)
    totalControllingPct = sum > 0 ? Number(sum.toFixed(2)) : null
  }

  // Free float from latest monthly report or first available
  const latestReport = monthlyReports[0]
  const rawFloat = latestReport?.freeFloatPct ?? null
  const floatNorm = normalizeOwnershipPercentage(rawFloat)

  const freeFloat = {
    percentage: floatNorm.value,
    shares: latestReport?.scriptlessShares ?? null,
    definition:
      'Berdasarkan rasio saham scriptless/publik di luar pengendali (KSEI / Sectors API).',
    isAnomaly: floatNorm.isAnomaly,
  }

  // Monthly shifts
  const shift = analyzeMonthlyOwnership(monthlyReports)

  // Current composition
  const currentComposition = latestReport
    ? {
        period: latestReport.period,
        localPct: latestReport.localPct ?? null,
        foreignPct: latestReport.foreignPct ?? null,
        categories: latestReport.categories ?? [],
      }
    : null

  // Insider movement
  const insiderMovement =
    insiderFilings.length > 0 ? analyzeInsiderMovement(insiderFilings, currentMarketPrice) : null

  return {
    symbol: cleanSymbol,
    topShareholders,
    totalControllingPct,
    freeFloat,
    currentComposition,
    shift,
    insiderMovement,
  }
}
