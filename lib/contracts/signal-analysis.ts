import { z } from 'zod'

export type SessionId = 'S1' | 'S2'
export type Horizon = 1 | 3 | 5

export type SignalOutcomeStatus =
  | 'PENDING'
  | 'AWAITING_DATA'
  | 'MATURED'
  | 'MISSING_PRICE'
  | 'CALENDAR_UNAVAILABLE'
  | 'CORPORATE_ACTION_SUSPENDED'

export type TechnicalConditionAssessment =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG_BEARISH'

export type StopScenarioStatus =
  | 'UNTRIGGERED'
  | 'SL_TRIGGERED'
  | 'TRAILING_TRIGGERED'
  | 'TIME_STOP_TRIGGERED'

export interface IntradayBar {
  ticker: string
  startAt: string // ISO string (e.g. 2026-09-22T09:00:00+07:00)
  endAt: string   // ISO string (e.g. 2026-09-22T09:05:00+07:00)
  open: number
  high: number
  low: number
  close: number
  volume: number
  source: string
}

export interface InitialRiskParams {
  initialATR: number
  tick: number
  buyFee: number
  sellFee: number
  stopSlippage: number
}

export interface SignalContext {
  id: string
  ticker: string
  signalAt: string
  referencePrice: number
  referencePriceAt: string
  ruleLabel: string
  provenance: {
    source: string
    snapshotId?: string
    details?: Record<string, unknown>
  }
  methodologyVersion: string
  initialRiskParams: InitialRiskParams
  createdAt: string
}

export interface SignalOutcome {
  horizon: Horizon
  targetAt: string
  targetSession: SessionId
  targetDate: string
  actualPrice: number | null
  grossReturn: number | null
  netReturn: number | null
  status: SignalOutcomeStatus
  notes?: string
}

export interface SignalAssessment {
  condition: TechnicalConditionAssessment
  summary: string
  ema20Daily: number | null
  isAboveEma20: boolean | null
  vwap: number | null
  isAboveVwap: boolean | null
  rvol: number | null
  rvolLogReturnScore: number | null
  stopStatus: StopScenarioStatus
  stopTriggeredAt?: string | null
}

export interface RiskPlan {
  entry: number
  buyFee: number
  sellFee: number
  initialATR: number
  tick: number
  costBasis: number // C = entry * (1 + buyFee)
  stopLoss: number  // SL = floorToTick(entry - 1.5 * initialATR)
  assumedStopExecution: number // SL - stopSlippage
  netRiskPerShare: number      // R = C - (SL - stopSlippage) * (1 - sellFee)
  takeProfit1: number // TP1 = ceilToTick((C + 1.25 * R) / (1 - sellFee))
  takeProfit2: number // TP2 = ceilToTick((C + 2.0 * R) / (1 - sellFee))
  breakEvenPrice: number // BEP = ceilToTick(C / (1 - sellFee) + stopSlippage)
  rrrTP1: number
  rrrTP2: number
  stopSlippage: number
  executionAssumptions: {
    tpType: 'LIMIT'
    slType: 'MARKET_ASSUMPTION'
    slippageTicks: number
  }
}

export interface ProjectionPriceDistribution {
  median: number
  p10: number
  p90: number
}

export interface ProjectionResult {
  status: 'COMPLETED' | 'INSUFFICIENT_DATA'
  asOf: string
  calibratedDays: number
  volatilities: {
    sigmaS1_5m: number
    sigmaS2_5m: number
    sigmaLunchGap: number
    sigmaOvernightGap: number
  }
  remainingSessionsCount: Record<Horizon, number>
  priceDistributions: Record<Horizon, ProjectionPriceDistribution>
  probabilities: {
    pTp1BeforeSl: number
    pTp2BeforeSl: number // independent metric, not in partition sum
    pSlBeforeTp1: number
    pNeitherTouched: number
    sumCheck: number // pTp1BeforeSl + pSlBeforeTp1 + pNeitherTouched ~= 1.0
  }
  dynamicStrategy: {
    winRatePct: number
    expectedReturnNetPct: number
    avgRMultiple: number
  }
  sensitivities: {
    volPlus25: { pTp1: number; pSl: number }
    volMinus25: { pTp1: number; pSl: number }
    slippage2Ticks: { pTp1: number; pSl: number; netRisk: number }
  }
  notes?: string
}

export interface SignalDataQuality {
  totalBars: number
  missingBars: number
  delayMinutes: number
  issues: string[]
}

export interface SignalModelParams {
  numPaths: number
  seed: number
  resolution: string
  prngVersion: string
}

export interface SignalAnalysisReport {
  context: SignalContext
  asOf: string
  outcomes: SignalOutcome[]
  assessment: SignalAssessment
  riskPlan: RiskPlan
  projection: ProjectionResult
  dataQuality: SignalDataQuality
  modelParams: SignalModelParams
  checksum: string
}

// ---------------------------------------------------------------------------
// Zod Schemas for Validation
// ---------------------------------------------------------------------------

export const EvaluateSignalAnalysisInputSchema = z.object({
  ticker: z.string().trim().min(1).max(10).toUpperCase(),
  contextId: z.string().trim().optional(),
  requestKey: z.string().trim().min(1).max(100),
})

export type EvaluateSignalAnalysisInput = z.infer<typeof EvaluateSignalAnalysisInputSchema>
