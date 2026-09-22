import type { NormalizedPricePoint } from './normalization.ts'

export interface RelativeStrengthResult {
  stockReturn: number | null
  benchmarkReturn: number | null
  relativeStrength: number | null // stockReturn - benchmarkReturn
  sessionsUsed: number
  startDate: string | null
  endDate: string | null
}

export interface TradingAnomalyMetrics {
  return1Session: number | null
  return5Sessions: number | null
  return20Sessions: number | null
  relativeStrengthVsBenchmark5: number | null
  relativeStrengthVsBenchmark20: number | null
  relativeVolume20: number | null
  historicalVolatility20: number | null
  maxDrawdown: number | null
}

/**
 * Calculates Relative Strength between a stock and a benchmark (e.g. IHSG/COMPOSITE).
 * CRITICAL RULE: Dates must align! Only compare across intersecting dates.
 */
export function calculateRelativeStrength(
  stockSeries: NormalizedPricePoint[],
  benchmarkSeries: NormalizedPricePoint[],
  nSessions: number,
): RelativeStrengthResult {
  if (
    !stockSeries ||
    stockSeries.length < nSessions + 1 ||
    !benchmarkSeries ||
    benchmarkSeries.length < nSessions + 1
  ) {
    return {
      stockReturn: null,
      benchmarkReturn: null,
      relativeStrength: null,
      sessionsUsed: 0,
      startDate: null,
      endDate: null,
    }
  }

  // Create date lookup map for benchmark
  const benchMap = new Map<string, number>()
  for (const b of benchmarkSeries) {
    benchMap.set(b.date, b.close)
  }

  // Find intersecting sessions
  const intersectingStock: NormalizedPricePoint[] = []
  for (const s of stockSeries) {
    if (benchMap.has(s.date)) {
      intersectingStock.push(s)
    }
  }

  if (intersectingStock.length < nSessions + 1) {
    return {
      stockReturn: null,
      benchmarkReturn: null,
      relativeStrength: null,
      sessionsUsed: 0,
      startDate: null,
      endDate: null,
    }
  }

  const endIndex = intersectingStock.length - 1
  const startIndex = endIndex - nSessions

  const startStock = intersectingStock[startIndex]
  const endStock = intersectingStock[endIndex]

  const startBenchClose = benchMap.get(startStock.date)!
  const endBenchClose = benchMap.get(endStock.date)!

  if (startStock.close <= 0 || startBenchClose <= 0) {
    return {
      stockReturn: null,
      benchmarkReturn: null,
      relativeStrength: null,
      sessionsUsed: 0,
      startDate: null,
      endDate: null,
    }
  }

  const stockReturn = endStock.close / startStock.close - 1
  const benchmarkReturn = endBenchClose / startBenchClose - 1
  const relativeStrength = stockReturn - benchmarkReturn

  return {
    stockReturn: Number(stockReturn.toFixed(6)),
    benchmarkReturn: Number(benchmarkReturn.toFixed(6)),
    relativeStrength: Number(relativeStrength.toFixed(6)),
    sessionsUsed: nSessions,
    startDate: startStock.date,
    endDate: endStock.date,
  }
}

/**
 * Calculates Relative Volume (RVol) against the 20-session SMA of volume.
 * Rule: Requires at least 21 observations.
 * Formula: latest volume / average volume of previous 20 sessions.
 */
export function calculateRelativeVolume(series: NormalizedPricePoint[]): number | null {
  if (!series || series.length < 21) {
    return null
  }

  const latest = series[series.length - 1].volume
  const past20 = series.slice(series.length - 21, series.length - 1)
  const sumPast20 = past20.reduce((acc, curr) => acc + curr.volume, 0)
  const avgPast20 = sumPast20 / 20

  if (avgPast20 <= 0) return null
  return Number((latest / avgPast20).toFixed(2))
}

/**
 * Calculates historical standard deviation of daily returns over a 20-session window.
 */
export function calculateHistoricalVolatility(
  series: NormalizedPricePoint[],
  window = 20,
): number | null {
  if (!series || series.length < window + 1) {
    return null
  }

  const returns: number[] = []
  const startIdx = series.length - 1 - window

  for (let i = startIdx + 1; i < series.length; i++) {
    const prev = series[i - 1].close
    const curr = series[i].close
    if (prev > 0) {
      returns.push(curr / prev - 1)
    }
  }

  if (returns.length < window) return null

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1)
  return Number(Math.sqrt(variance).toFixed(6))
}

/**
 * Calculates maximum drawdown within the provided series.
 * Formula: (trough - peak) / peak.
 */
export function calculateMaxDrawdown(series: NormalizedPricePoint[]): number | null {
  if (!series || series.length < 2) return null

  let peak = series[0].close
  let maxDrawdown = 0

  for (const item of series) {
    if (item.close > peak) {
      peak = item.close
    } else if (peak > 0) {
      const dd = (item.close - peak) / peak
      if (dd < maxDrawdown) {
        maxDrawdown = dd
      }
    }
  }

  return Number(maxDrawdown.toFixed(6))
}
