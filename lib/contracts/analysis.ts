import type { DataEnvelope, DataState } from './market.ts'

export const SNAPSHOT_SCHEMA_VERSION = '1.0.0'
export const RASI_RULE_VERSION = '1.0.0'

export const COMPOSITE_WEIGHTS = {
  fundamental: 0.25,
  broker: 0.35,
  divergence: 0.25,
  insider: 0.15,
} as const

export type IndicatorStatus =
  'CRITICAL' | 'HIGH' | 'WARNING' | 'NORMAL' | 'UNKNOWN' | 'INSUFFICIENT_DATA'

export interface FundamentalIndicator {
  dataState: DataState
  pe: number | null
  pb: number | null
  year: number | null
  riskScore: number | null // 0 (safe) - 100 (high risk)
  status: IndicatorStatus
  reason: string
}

export interface TopBrokerItem {
  code: string
  name?: string
  isForeign: boolean
  cohort: string
  lot: number
  value: number
  avgPrice: number
  netValue: number
}

export interface BandarmologyIndicator {
  dataState: DataState
  status:
    | 'BIG_ACCUMULATION'
    | 'NORMAL_ACCUMULATION'
    | 'NEUTRAL'
    | 'NORMAL_DISTRIBUTION'
    | 'BIG_DISTRIBUTION'
    | 'INSUFFICIENT_DATA'
  bandarScore: number | null // 0 - 100
  cr3Buy: number | null
  cr5Buy: number | null
  cr3Sell: number | null
  cr5Sell: number | null
  topBuyers: TopBrokerItem[]
  topSellers: TopBrokerItem[]
  foreignBuyVal: number | null
  foreignSellVal: number | null
  netForeignVal: number | null
  foreignFlowStatus: 'HEAVY_INFLOW' | 'INFLOW' | 'NEUTRAL' | 'OUTFLOW' | 'HEAVY_OUTFLOW' | 'UNKNOWN'
  bandarAvgPrice: number | null
  currentPrice: number | null
  flowSummary: string
  date: string | null
}

export interface VolumeSpikeIndicator {
  dataState: DataState
  spikeRatio: number | null
  formattedRatio: string
  status: 'EXTREME' | 'HIGH' | 'NORMAL' | 'LOW' | 'UNKNOWN'
  todayVolume: number | null
  avgVolume: number | null
  observationCount: number
  dateRange: { start: string | null; end: string | null }
}

export interface DivergenceIndicator {
  dataState: DataState
  status:
    | 'SLEEPING_GIANT'
    | 'PRICED_IN_RALLY'
    | 'DELAYED_SELL_OFF_RISK'
    | 'NORMAL_REACTION'
    | 'NO_PRICE_RESPONSE'
    | 'NO_CATALYST'
    | 'INSUFFICIENT_DATA'
  divergenceScore: number | null // 0 to 100
  priceChangePct: number | null
  headline: string | null
  impactScore: number | null
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'
  catalystType: string | null
  verdict: string
  recommendation: string
  newsTimestamp?: string | null
}

export interface InsiderFilingDetail {
  holderName: string
  holderType: string
  action: 'BUY' | 'SELL' | 'OTHER'
  amountShares: number
  transactionPrice: number | null
  totalValueIdr: number
  pctChanged: number | null // In percentage points (e.g. 2.56 means 2.56%)
  date: string
  notes: string
  sourceUrl?: string
}

export interface InsiderIndicator {
  dataState: DataState
  hasInsiderActivity: boolean
  status:
    | 'STEEP_DISCOUNT_DUMP'
    | 'AGGRESSIVE_BUY'
    | 'MASSIVE_DIVESTMENT'
    | 'CONGLOMERATE_SHUFFLE'
    | 'ROUTINE_TRANSACTION'
    | 'NO_RECENT_FILINGS'
    | 'INSUFFICIENT_DATA'
  insiderRiskScore: number | null // 0 (safe) to 100 (extreme warning)
  latestFiling: InsiderFilingDetail | null
  filingsCount: number
  summary: string
}

export interface CompositeScoreResult {
  score: number | null // 0 - 100 or null if any pillar is incomplete
  status: 'CRITICAL' | 'HIGH' | 'WARNING' | 'NORMAL' | 'INSUFFICIENT_DATA'
  reason: string
  weights: typeof COMPOSITE_WEIGHTS
  ruleVersion: string
  componentsComplete: boolean
  pillarScores: {
    fundamental: number | null
    broker: number | null
    divergence: number | null
    insider: number | null
  }
}

export interface AnalysisSnapshot {
  id: string
  ticker: string
  companyName: string
  createdAt: string // ISO timestamp in UTC
  schemaVersion: string
  ruleVersion: string
  price: number | null
  priceChangeFraction: number | null // 0.025 = 2.5%
  priceDate: string | null
  envelopes: {
    valuation: DataEnvelope<unknown>
    daily: DataEnvelope<unknown>
    broker: DataEnvelope<unknown>
    news: DataEnvelope<unknown>
    filings: DataEnvelope<unknown>
  }
  indicators: {
    fundamental: FundamentalIndicator
    bandarmology: BandarmologyIndicator
    volume: VolumeSpikeIndicator
    divergence: DivergenceIndicator
    insider: InsiderIndicator
  }
  composite: CompositeScoreResult
  provenance: {
    newsAnalysis: 'GEMINI' | 'RULE_BASED' | 'UNAVAILABLE'
    model?: string
  }
}
