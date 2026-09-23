import type { RiskPlan } from '../lib/contracts/signal-analysis.ts'

export interface TradeRiskInput {
  entry: number
  initialATR: number
  tick?: number
  buyFee?: number
  sellFee?: number
  stopSlippageTicks?: number
}

export interface PositionSizeResult {
  totalLots: number
  tp1Lots: number
  tp2Lots: number
  totalCapitalRequired: number
  totalRiskAllocated: number
  riskFractionActual: number
}

/**
 * Returns IDX price fraction (tick size) based on price level:
 * < 200: 1
 * 200 to < 500: 2
 * 500 to < 2000: 5
 * 2000 to < 5000: 10
 * >= 5000: 25
 */
export function getIdxTickSize(price: number): number {
  if (price < 200) return 1
  if (price < 500) return 2
  if (price < 2000) return 5
  if (price < 5000) return 10
  return 25
}

/**
 * Rounds down to the nearest valid tick.
 */
export function floorToTick(price: number, tick: number): number {
  if (tick <= 0) return Math.floor(price)
  return Math.floor(price / tick) * tick
}

/**
 * Rounds up to the nearest valid tick.
 */
export function ceilToTick(price: number, tick: number): number {
  if (tick <= 0) return Math.ceil(price)
  return Math.ceil(price / tick) * tick
}

/**
 * Calculates the comprehensive trade risk plan with fees and tick constraints.
 */
export function calculateRiskPlan(input: TradeRiskInput): RiskPlan {
  const {
    entry,
    initialATR,
    buyFee = 0.0015, // 0.15%
    sellFee = 0.0025, // 0.25%
    stopSlippageTicks = 1,
  } = input

  const tick = input.tick ?? getIdxTickSize(entry)
  const stopSlippage = stopSlippageTicks * tick

  // Cost basis: C = entry * (1 + buyFee)
  const costBasis = Number((entry * (1 + buyFee)).toFixed(4))

  // Stop loss: SL = floorToTick(entry - 1.5 * initialATR, tick)
  const rawSL = entry - 1.5 * initialATR
  const stopLoss = floorToTick(rawSL, tick)

  // Assumed stop execution with slippage
  const assumedStopExecution = stopLoss - stopSlippage

  // Net risk per share: R = C - (SL - stopSlippage) * (1 - sellFee)
  const netRiskPerShare = Number(
    (costBasis - assumedStopExecution * (1 - sellFee)).toFixed(4),
  )

  // TP1: ceilToTick((C + 1.25 * R) / (1 - sellFee), tick)
  const rawTP1 = (costBasis + 1.25 * netRiskPerShare) / (1 - sellFee)
  const takeProfit1 = ceilToTick(rawTP1, tick)

  // TP2: ceilToTick((C + 2.0 * R) / (1 - sellFee), tick)
  const rawTP2 = (costBasis + 2.0 * netRiskPerShare) / (1 - sellFee)
  const takeProfit2 = ceilToTick(rawTP2, tick)

  // BEP: ceilToTick(C / (1 - sellFee) + stopSlippage, tick)
  const rawBEP = costBasis / (1 - sellFee) + stopSlippage
  const breakEvenPrice = ceilToTick(rawBEP, tick)

  // Actual realized RRR at TP1 and TP2 after fees
  const netGainTP1 = takeProfit1 * (1 - sellFee) - costBasis
  const rrrTP1 = netRiskPerShare > 0 ? Number((netGainTP1 / netRiskPerShare).toFixed(2)) : 0

  const netGainTP2 = takeProfit2 * (1 - sellFee) - costBasis
  const rrrTP2 = netRiskPerShare > 0 ? Number((netGainTP2 / netRiskPerShare).toFixed(2)) : 0

  return {
    entry,
    buyFee,
    sellFee,
    initialATR,
    tick,
    costBasis,
    stopLoss,
    assumedStopExecution,
    netRiskPerShare,
    takeProfit1,
    takeProfit2,
    breakEvenPrice,
    rrrTP1,
    rrrTP2,
    stopSlippage,
    executionAssumptions: {
      tpType: 'LIMIT',
      slType: 'MARKET_ASSUMPTION',
      slippageTicks: stopSlippageTicks,
    },
  }
}

/**
 * Calculates trailing stop level after TP1 has been hit.
 * trailing = max(previousStop, BEP, floorToTick(highest15mClose - initialATR, tick))
 */
export function calculateTrailingStop(params: {
  previousStop: number
  breakEvenPrice: number
  highestCompleted15mCloseSinceTP1: number
  initialATR: number
  tick: number
}): number {
  const { previousStop, breakEvenPrice, highestCompleted15mCloseSinceTP1, initialATR, tick } =
    params

  const candidate = floorToTick(highestCompleted15mCloseSinceTP1 - initialATR, tick)
  return Math.max(previousStop, breakEvenPrice, candidate)
}

/**
 * Calculates optional local position sizing in lots.
 * lots = min(floor((capital * riskFraction) / (100 * R)), floor(availableCash / (100 * C)))
 * Odd lots: floor(lots / 2) on TP1; 1 lot is entirely allocated to TP1.
 */
export function calculatePositionSize(params: {
  capital: number
  availableCash?: number
  costBasis: number
  netRiskPerShare: number
  maxRiskFraction?: number // default 0.5% (0.005)
}): PositionSizeResult {
  const {
    capital,
    availableCash = capital,
    costBasis,
    netRiskPerShare,
    maxRiskFraction = 0.005,
  } = params

  if (capital <= 0 || costBasis <= 0 || netRiskPerShare <= 0) {
    return {
      totalLots: 0,
      tp1Lots: 0,
      tp2Lots: 0,
      totalCapitalRequired: 0,
      totalRiskAllocated: 0,
      riskFractionActual: 0,
    }
  }

  const maxAllowedRisk = capital * maxRiskFraction
  const lotsByRisk = Math.floor(maxAllowedRisk / (100 * netRiskPerShare))
  const lotsByCash = Math.floor(availableCash / (100 * costBasis))

  const totalLots = Math.max(0, Math.min(lotsByRisk, lotsByCash))

  let tp1Lots = 0
  let tp2Lots = 0

  if (totalLots === 1) {
    tp1Lots = 1
    tp2Lots = 0
  } else if (totalLots > 1) {
    tp1Lots = Math.floor(totalLots / 2)
    tp2Lots = totalLots - tp1Lots
  }

  const totalCapitalRequired = Number((totalLots * 100 * costBasis).toFixed(2))
  const totalRiskAllocated = Number((totalLots * 100 * netRiskPerShare).toFixed(2))
  const riskFractionActual =
    capital > 0 ? Number((totalRiskAllocated / capital).toFixed(6)) : 0

  return {
    totalLots,
    tp1Lots,
    tp2Lots,
    totalCapitalRequired,
    totalRiskAllocated,
    riskFractionActual,
  }
}
