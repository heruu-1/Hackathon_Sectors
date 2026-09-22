/**
 * Fundamentals domain module: calculations, YoY comparisons, and industry-specific metrics.
 */
import type { RawQuarterlyFinancial } from '../lib/server/providers/quarterly.ts'

export type BusinessGroup = 'BANK' | 'INSURANCE' | 'NON_FINANCIAL'

export interface GrowthMetric {
  currentValue: number | null
  previousValue: number | null
  growthFraction: number | null
  growthLabel: string // e.g. "+12.5%", "Berbalik Laba", "Berbalik Rugi", "N/A"
  nominalDiff: number | null
}

export interface NonFinancialFundamentalAnalysis {
  group: 'NON_FINANCIAL'
  quarter: string
  revenueGrowth: GrowthMetric
  netIncomeGrowth: GrowthMetric
  netMarginCurrent: number | null // fraction
  netMarginPrevious: number | null
  marginChangePoints: number | null // percentage points
  operatingCashFlow: number | null
  isCashFlowDivergent: boolean // R07: Net income > 0 but OCF < 0
  debtToEquity: number | null // DER
  basis: 'standalone' | 'YTD' | 'unknown'
}

export interface BankFundamentalAnalysis {
  group: 'BANK'
  quarter: string
  netInterestIncomeGrowth: GrowthMetric
  netIncomeGrowth: GrowthMetric
  loanGrowth?: GrowthMetric
  depositGrowth?: GrowthMetric
  loanToDepositRatio?: number | null // LDR
  basis: 'standalone' | 'YTD' | 'unknown'
}

export type FundamentalAnalysisResult = NonFinancialFundamentalAnalysis | BankFundamentalAnalysis

export function classifyBusinessGroup(sector?: string, subSector?: string): BusinessGroup {
  const sec = (sector ?? '').toLowerCase()
  const sub = (subSector ?? '').toLowerCase()

  if (sec.includes('finan') || sec.includes('keuangan')) {
    if (sub.includes('bank') || sub.includes('perbankan')) {
      return 'BANK'
    }
    if (sub.includes('insur') || sub.includes('asuransi')) {
      return 'INSURANCE'
    }
    return 'BANK' // default financial institution to banking metrics
  }

  return 'NON_FINANCIAL'
}

export function calculateGrowth(
  current: number | null | undefined,
  previous: number | null | undefined,
): GrowthMetric {
  const curr = current ?? null
  const prev = previous ?? null

  if (curr === null || prev === null) {
    return {
      currentValue: curr,
      previousValue: prev,
      growthFraction: null,
      growthLabel: 'Data tidak lengkap',
      nominalDiff: null,
    }
  }

  const diff = curr - prev

  // Baseline was 0 or negative, now positive
  if (prev <= 0 && curr > 0) {
    return {
      currentValue: curr,
      previousValue: prev,
      growthFraction: null,
      growthLabel: 'Berbalik Laba',
      nominalDiff: diff,
    }
  }

  // Baseline was positive, now 0 or negative
  if (prev > 0 && curr <= 0) {
    return {
      currentValue: curr,
      previousValue: prev,
      growthFraction: null,
      growthLabel: 'Berbalik Rugi',
      nominalDiff: diff,
    }
  }

  // Normal positive baseline
  if (prev > 0) {
    const fraction = diff / prev
    const sign = fraction >= 0 ? '+' : ''
    return {
      currentValue: curr,
      previousValue: prev,
      growthFraction: Number(fraction.toFixed(4)),
      growthLabel: `${sign}${(fraction * 100).toFixed(2)}%`,
      nominalDiff: diff,
    }
  }

  return {
    currentValue: curr,
    previousValue: prev,
    growthFraction: null,
    growthLabel: curr < prev ? 'Rugi Bertambah' : 'Rugi Berkurang',
    nominalDiff: diff,
  }
}

/**
 * Computes fundamental analysis for a company given its quarters and industry sector.
 * Finds matching YoY quarter (e.g. 2024-Q3 vs 2023-Q3, index 0 vs index 4).
 */
export function analyzeFundamentals(
  quarters: RawQuarterlyFinancial[],
  sector?: string,
  subSector?: string,
): FundamentalAnalysisResult | null {
  if (!quarters || quarters.length === 0) {
    return null
  }

  const group = classifyBusinessGroup(sector, subSector)
  const current = quarters[0] // Latest quarter
  // Look for YoY quarter (same Q in previous year, typically index 4 if 5 quarters present)
  const previous = quarters.length >= 5 ? quarters[4] : quarters[quarters.length - 1]

  if (group === 'BANK') {
    const niiGrowth = calculateGrowth(current.net_interest_income, previous.net_interest_income)
    const netIncomeGrowth = calculateGrowth(current.net_income, previous.net_income)
    const loanGrowth = calculateGrowth(current.loans, previous.loans)
    const depositGrowth = calculateGrowth(current.deposits, previous.deposits)

    const ldr =
      current.loans && current.deposits && current.deposits > 0
        ? Number((current.loans / current.deposits).toFixed(4))
        : null

    return {
      group: 'BANK',
      quarter: current.quarter,
      netInterestIncomeGrowth: niiGrowth,
      netIncomeGrowth,
      loanGrowth,
      depositGrowth,
      loanToDepositRatio: ldr,
      basis: current.basis ?? 'unknown',
    }
  }

  // NON_FINANCIAL
  const revGrowth = calculateGrowth(current.revenue, previous.revenue)
  const netIncomeGrowth = calculateGrowth(current.net_income, previous.net_income)

  const currentMargin =
    current.revenue &&
    current.revenue > 0 &&
    current.net_income !== null &&
    current.net_income !== undefined
      ? current.net_income / current.revenue
      : null

  const previousMargin =
    previous.revenue &&
    previous.revenue > 0 &&
    previous.net_income !== null &&
    previous.net_income !== undefined
      ? previous.net_income / previous.revenue
      : null

  const marginChangePoints =
    currentMargin !== null && previousMargin !== null
      ? Number(((currentMargin - previousMargin) * 100).toFixed(2))
      : null

  // R07: Net income > 0 but OCF < 0
  const isCashFlowDivergent =
    (current.net_income ?? 0) > 0 && (current.operating_cash_flow ?? 0) < 0

  // DER: liabilities / equity
  const der =
    current.total_liabilities && current.total_equity && current.total_equity > 0
      ? Number((current.total_liabilities / current.total_equity).toFixed(2))
      : null

  return {
    group: 'NON_FINANCIAL',
    quarter: current.quarter,
    revenueGrowth: revGrowth,
    netIncomeGrowth,
    netMarginCurrent: currentMargin ? Number(currentMargin.toFixed(4)) : null,
    netMarginPrevious: previousMargin ? Number(previousMargin.toFixed(4)) : null,
    marginChangePoints,
    operatingCashFlow: current.operating_cash_flow ?? null,
    isCashFlowDivergent,
    debtToEquity: der,
    basis: current.basis ?? 'unknown',
  }
}
