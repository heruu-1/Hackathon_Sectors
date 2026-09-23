import type {
  IntradayBar,
  SignalAssessment,
  StopScenarioStatus,
  TechnicalConditionAssessment,
} from '../lib/contracts/signal-analysis.ts'

export interface WilderAtrResult {
  atr: number
  barsUsed: number
  isValid: boolean
}

/**
 * Calculates Wilder's 14-period Average True Range from historical session bars.
 * Requires at least 15 consecutive valid bars (so that 14 TR transitions exist).
 * All bars must be strictly prior to signal time.
 */
export function calculateWilderATR(bars: IntradayBar[], period = 14): WilderAtrResult {
  if (bars.length < period + 1) {
    return { atr: 0, barsUsed: bars.length, isValid: false }
  }

  // Calculate True Range for each bar from index 1
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const cur = bars[i]
    const prev = bars[i - 1]
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    trs.push(tr)
  }

  if (trs.length < period) {
    return { atr: 0, barsUsed: bars.length, isValid: false }
  }

  // Initial ATR is simple average of first `period` TRs
  let currentAtr = trs.slice(0, period).reduce((sum, val) => sum + val, 0) / period

  // Wilder smoothing for subsequent bars
  for (let i = period; i < trs.length; i++) {
    currentAtr = (currentAtr * (period - 1) + trs[i]) / period
  }

  return {
    atr: currentAtr,
    barsUsed: bars.length,
    isValid: true,
  }
}

/**
 * Calculates EMA-20 on completed daily closing prices.
 * Returns null if fewer than 20 daily closes are available.
 */
export function calculateEMA20(dailyCloses: number[], period = 20): number | null {
  if (dailyCloses.length < period) return null

  const k = 2 / (period + 1)
  // Initialize EMA with SMA of first `period` prices
  let ema = dailyCloses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < dailyCloses.length; i++) {
    ema = dailyCloses[i] * k + ema * (1 - k)
  }

  return Number(ema.toFixed(2))
}

/**
 * Calculates Volume Weighted Average Price (VWAP) on valid intraday bars.
 * Uses typical price (H + L + C) / 3.
 * Returns null if total volume is zero or no bars are provided.
 */
export function calculateVWAP(bars: IntradayBar[]): number | null {
  if (bars.length === 0) return null

  let sumPriceVolume = 0
  let totalVolume = 0

  for (const bar of bars) {
    if (bar.volume > 0) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3
      sumPriceVolume += typicalPrice * bar.volume
      totalVolume += bar.volume
    }
  }

  if (totalVolume === 0) return null
  return Number((sumPriceVolume / totalVolume).toFixed(2))
}

/**
 * Calculates Relative Volume (RVOL) comparing current session volume against historical average.
 * Returns null if baseline history is insufficient.
 */
export function calculateRVOL(
  currentSessionVolume: number,
  historicalSessionVolumes: number[],
): number | null {
  if (historicalSessionVolumes.length < 5) return null

  const avgHistorical =
    historicalSessionVolumes.reduce((a, b) => a + b, 0) / historicalSessionVolumes.length

  if (avgHistorical <= 0) return null
  return Number((currentSessionVolume / avgHistorical).toFixed(2))
}

/**
 * Checks stop loss trigger across all completed bars since signal inception.
 * Scans remainder of signal session and all subsequent bars up to asOf.
 */
export function checkStopScenarios(
  barsSinceSignal: IntradayBar[],
  stopLossPrice: number,
): {
  status: StopScenarioStatus
  triggeredAt: string | null
} {
  for (const bar of barsSinceSignal) {
    if (bar.low <= stopLossPrice) {
      return {
        status: 'SL_TRIGGERED',
        triggeredAt: bar.startAt,
      }
    }
  }

  return {
    status: 'UNTRIGGERED',
    triggeredAt: null,
  }
}

/**
 * Synthesizes a comprehensive technical assessment.
 */
export function assessSignalConditions(params: {
  currentPrice: number
  referencePrice: number
  vwap: number | null
  ema20: number | null
  rvol: number | null
  stopLoss: number
  barsSinceSignal: IntradayBar[]
}): SignalAssessment {
  const { currentPrice, referencePrice, vwap, ema20, rvol, stopLoss, barsSinceSignal } = params

  const isAboveVwap = vwap !== null ? currentPrice >= vwap : null
  const isAboveEma20 = ema20 !== null ? currentPrice >= ema20 : null

  // Stop check
  const stopCheck = checkStopScenarios(barsSinceSignal, stopLoss)

  // RVOL log-return score
  let rvolLogReturnScore: number | null = null
  if (rvol !== null && referencePrice > 0 && currentPrice > 0) {
    const logReturn = Math.log(currentPrice / referencePrice)
    rvolLogReturnScore = Number((rvol * logReturn).toFixed(4))
  }

  // Determine condition
  let condition: TechnicalConditionAssessment = 'NEUTRAL'
  let summary = ''

  if (stopCheck.status === 'SL_TRIGGERED') {
    condition = 'BEARISH'
    summary = `Batas risiko terpicu: harga menyentuh level Stop Loss Rp ${stopLoss.toLocaleString('id-ID')}.`
  } else {
    let bullishSignals = 0
    let bearishSignals = 0

    if (isAboveVwap === true) bullishSignals++
    if (isAboveVwap === false) bearishSignals++

    if (isAboveEma20 === true) bullishSignals++
    if (isAboveEma20 === false) bearishSignals++

    if (currentPrice > referencePrice) bullishSignals++
    if (currentPrice < referencePrice) bearishSignals++

    if (rvol !== null && rvol > 1.2 && currentPrice > referencePrice) bullishSignals++

    if (bullishSignals >= 3) {
      condition = 'STRONG_BULLISH'
      summary = 'Kondisi teknis sangat kuat: harga bertahan di atas VWAP, EMA-20, dan harga acuan dengan volume sehat.'
    } else if (bullishSignals > bearishSignals) {
      condition = 'BULLISH'
      summary = 'Kondisi teknis positif: harga berada di atas level acuan/VWAP dengan skenario stop terjaga.'
    } else if (bearishSignals >= 3) {
      condition = 'BEARISH'
      summary = 'Kondisi teknis melemah: harga tertekan di bawah VWAP atau tren rata-rata, dekati batas risiko.'
    } else {
      condition = 'NEUTRAL'
      summary = 'Kondisi teknis konsolidasi: pergerakan harga relatif berimbang terhadap VWAP dan harga acuan.'
    }
  }

  return {
    condition,
    summary,
    ema20Daily: ema20,
    isAboveEma20,
    vwap,
    isAboveVwap,
    rvol,
    rvolLogReturnScore,
    stopStatus: stopCheck.status,
    stopTriggeredAt: stopCheck.triggeredAt,
  }
}
