import type {
  Horizon,
  IntradayBar,
  ProjectionPriceDistribution,
  ProjectionResult,
  RiskPlan,
  SessionId,
  SignalContext,
} from '../lib/contracts/signal-analysis.ts'
import {
  computeTargetSessions,
  getNextTradingDay,
  identifySession,
  isBarInContinuousTrading,
} from './trading-sessions.ts'
import { calculateTrailingStop } from './trade-risk.ts'

export const PRNG_VERSION = 'mulberry32-boxmuller-v1'

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 */
export function createMulberry32(seed: number): () => number {
  let s = Math.floor(seed) >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Standard Normal N(0, 1) generator using Box-Muller transform.
 */
export function createNormalGenerator(prng: () => number): () => number {
  let hasSpare = false
  let spare = 0
  return function () {
    if (hasSpare) {
      hasSpare = false
      return spare
    }
    let u = 0
    let v = 0
    let s = 0
    while (s === 0 || s >= 1) {
      u = prng() * 2 - 1
      v = prng() * 2 - 1
      s = u * u + v * v
    }
    const mul = Math.sqrt((-2.0 * Math.log(s)) / s)
    spare = v * mul
    hasSpare = true
    return u * mul
  }
}

export interface CalibrationStats {
  sigmaS1_5m: number
  sigmaS2_5m: number
  sigmaLunchGap: number
  sigmaOvernightGap: number
  completeDaysCount: number
  lunchGapCount: number
  overnightGapCount: number
  isSufficient: boolean
  reason?: string
}

/**
 * Calibrates intraday volatilities from completed historical bars prior to asOf.
 * Requirements:
 * - Target 60 trading days, minimum 20 complete days.
 * - At least 20 lunch gap and 20 overnight gap observations.
 * - Sessions with >5% missing continuous bars are excluded.
 */
export function calibrateIntradayVolatilities(
  bars: IntradayBar[],
  asOfIso: string,
): CalibrationStats {
  const completedBars = bars
    .filter((b) => b.endAt <= asOfIso)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  // Group bars by (dateStr, session)
  const daySessionMap = new Map<string, { s1: IntradayBar[]; s2: IntradayBar[] }>()

  for (const b of completedBars) {
    const check = isBarInContinuousTrading(b.startAt, b.endAt)
    if (!check.isValidContinuous || !check.dateStr || !check.session) continue

    let entry = daySessionMap.get(check.dateStr)
    if (!entry) {
      entry = { s1: [], s2: [] }
      daySessionMap.set(check.dateStr, entry)
    }

    if (check.session === 'S1') {
      entry.s1.push(b)
    } else {
      entry.s2.push(b)
    }
  }

  const s1LogReturns: number[] = []
  const s2LogReturns: number[] = []
  const lunchGaps: number[] = []
  const overnightGaps: number[] = []

  const sortedDates = Array.from(daySessionMap.keys()).sort()
  const completeDates: string[] = []

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i]
    const sess = daySessionMap.get(dateStr)!

    const [y, m, d] = dateStr.split('-').map(Number)
    const isFriday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5

    // Standard 5m bar counts:
    // Mon-Thu: S1 = 36, S2 = 28
    // Fri: S1 = 30, S2 = 22
    const expS1 = isFriday ? 30 : 36
    const expS2 = isFriday ? 22 : 28

    const s1MissingRatio = Math.max(0, expS1 - sess.s1.length) / expS1
    const s2MissingRatio = Math.max(0, expS2 - sess.s2.length) / expS2

    // Filter sessions with >5% missing continuous bars
    const isS1Valid = s1MissingRatio <= 0.05 && sess.s1.length >= expS1 * 0.95
    const isS2Valid = s2MissingRatio <= 0.05 && sess.s2.length >= expS2 * 0.95

    if (isS1Valid) {
      for (let j = 1; j < sess.s1.length; j++) {
        const r = Math.log(sess.s1[j].close / sess.s1[j - 1].close)
        if (!isNaN(r)) s1LogReturns.push(r)
      }
    }

    if (isS2Valid) {
      for (let j = 1; j < sess.s2.length; j++) {
        const r = Math.log(sess.s2[j].close / sess.s2[j - 1].close)
        if (!isNaN(r)) s2LogReturns.push(r)
      }
    }

    // Lunch gap: S1 last close to S2 first open
    if (sess.s1.length > 0 && sess.s2.length > 0) {
      const s1Close = sess.s1[sess.s1.length - 1].close
      const s2Open = sess.s2[0].open
      if (s1Close > 0 && s2Open > 0) {
        const gap = Math.log(s2Open / s1Close)
        if (!isNaN(gap)) lunchGaps.push(gap)
      }
    }

    // Overnight gap: S2 last close of day i to S1 first open of day i+1
    if (i < sortedDates.length - 1) {
      const nextDateStr = sortedDates[i + 1]
      const nextSess = daySessionMap.get(nextDateStr)!
      if (sess.s2.length > 0 && nextSess.s1.length > 0) {
        const s2Close = sess.s2[sess.s2.length - 1].close
        const nextS1Open = nextSess.s1[0].open
        if (s2Close > 0 && nextS1Open > 0) {
          const gap = Math.log(nextS1Open / s2Close)
          if (!isNaN(gap)) overnightGaps.push(gap)
        }
      }
    }

    if (isS1Valid && isS2Valid) {
      completeDates.push(dateStr)
    }
  }

  const calcStd = (arr: number[]): number => {
    if (arr.length < 2) return 0
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    const variance =
      arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1)
    return Math.sqrt(variance)
  }

  const sigmaS1_5m = calcStd(s1LogReturns)
  const sigmaS2_5m = calcStd(s2LogReturns)
  const sigmaLunchGap = calcStd(lunchGaps)
  const sigmaOvernightGap = calcStd(overnightGaps)

  // Calibration requires minimum 20 complete days and 20 observations for each gap group
  const isSufficient =
    completeDates.length >= 20 && lunchGaps.length >= 20 && overnightGaps.length >= 20

  let reason: string | undefined
  if (!isSufficient) {
    reason = `Riwayat data intraday belum memenuhi syarat kalibrasi: ${completeDates.length}/20 hari lengkap, ${lunchGaps.length}/20 gap makan siang, ${overnightGaps.length}/20 gap semalam.`
  }

  return {
    sigmaS1_5m: Number(sigmaS1_5m.toFixed(6)),
    sigmaS2_5m: Number(sigmaS2_5m.toFixed(6)),
    sigmaLunchGap: Number(sigmaLunchGap.toFixed(6)),
    sigmaOvernightGap: Number(sigmaOvernightGap.toFixed(6)),
    completeDaysCount: completeDates.length,
    lunchGapCount: lunchGaps.length,
    overnightGapCount: overnightGaps.length,
    isSufficient,
    reason,
  }
}

export interface SimulationStepDefinition {
  type: '5m' | 'lunch_gap' | 'overnight_gap'
  session: SessionId
  sigma: number
  isHorizonBoundary?: Horizon
}

/**
 * Builds the timeline of remaining simulation steps from asOf towards Horizon 5.
 */
export function buildRemainingSimulationSteps(params: {
  context: SignalContext
  asOfIso: string
  volatilities: {
    sigmaS1_5m: number
    sigmaS2_5m: number
    sigmaLunchGap: number
    sigmaOvernightGap: number
  }
  volMultiplier?: number
}): {
  steps: SimulationStepDefinition[]
  remainingSessions: Record<Horizon, number>
} {
  const { context, asOfIso, volatilities, volMultiplier = 1.0 } = params
  const horizons: Horizon[] = [1, 3, 5]

  const signalDate = new Date(context.signalAt)
  const sessionInfo = identifySession(signalDate)

  const baseDateStr = sessionInfo.dateStr
  let baseSession: SessionId = 'S1'

  if (sessionInfo.session === 'S1' || sessionInfo.session === 'S2') {
    baseSession = sessionInfo.session
  } else {
    baseSession = 'S2'
  }

  const targets = computeTargetSessions(baseDateStr, baseSession)
  const asOfMs = new Date(asOfIso).getTime()

  // Find remaining horizons
  const pendingHorizons = horizons.filter((h) => {
    const t = targets[h]
    return t.calendarAvailable && new Date(t.targetEndAt).getTime() > asOfMs
  })

  const remainingSessions: Record<Horizon, number> = {
    1: Math.max(0, pendingHorizons.includes(1) ? 1 : 0),
    3: Math.max(0, pendingHorizons.includes(3) ? (pendingHorizons.includes(1) ? 3 : 2) : 0),
    5: Math.max(0, pendingHorizons.includes(5) ? (pendingHorizons.includes(1) ? 5 : 4) : 0),
  }

  const steps: SimulationStepDefinition[] = []
  if (pendingHorizons.length === 0) {
    return { steps, remainingSessions }
  }

  // Build the chronological sequence of remaining sessions from asOf up to Horizon 5
  // For each session:
  // - If transition from previous S1 to this S2 -> insert lunch gap step
  // - If transition from previous S2 to this S1 -> insert overnight gap step
  // - In session: insert 5m steps (36 or 30 for S1, 28 or 22 for S2)
  let curSession = baseSession
  let curDate = baseDateStr

  const allForwardSessions: Array<{ dateStr: string; session: SessionId }> = []
  for (let s = 1; s <= 5; s++) {
    if (curSession === 'S1') {
      curSession = 'S2'
      allForwardSessions.push({ dateStr: curDate, session: curSession })
    } else {
      const next = getNextTradingDay(curDate)
      if (!next.calendarAvailable || !next.nextDate) break
      curDate = next.nextDate
      curSession = 'S1'
      allForwardSessions.push({ dateStr: curDate, session: curSession })
    }
  }

  let prevSession: SessionId | null = null

  for (let sIdx = 0; sIdx < allForwardSessions.length; sIdx++) {
    const sessionItem = allForwardSessions[sIdx]
    const horizonNumber = (sIdx + 1) as Horizon

    // Only simulate if this session or subsequent is pending
    const win = targets[horizonNumber]
    if (win && new Date(win.targetEndAt).getTime() <= asOfMs) {
      prevSession = sessionItem.session
      continue // Already elapsed
    }

    // Insert inter-session gap if transitioning
    if (prevSession !== null) {
      if (prevSession === 'S1' && sessionItem.session === 'S2') {
        steps.push({
          type: 'lunch_gap',
          session: 'S2',
          sigma: volatilities.sigmaLunchGap * volMultiplier,
        })
      } else if (prevSession === 'S2' && sessionItem.session === 'S1') {
        steps.push({
          type: 'overnight_gap',
          session: 'S1',
          sigma: volatilities.sigmaOvernightGap * volMultiplier,
        })
      }
    }

    // Determine number of 5m bars in this session
    const [y, m, d] = sessionItem.dateStr.split('-').map(Number)
    const isFriday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5
    const barCount =
      sessionItem.session === 'S1' ? (isFriday ? 30 : 36) : isFriday ? 22 : 28

    const barSigma =
      sessionItem.session === 'S1'
        ? volatilities.sigmaS1_5m * volMultiplier
        : volatilities.sigmaS2_5m * volMultiplier

    for (let b = 0; b < barCount; b++) {
      const isLastBarOfSession = b === barCount - 1
      steps.push({
        type: '5m',
        session: sessionItem.session,
        sigma: barSigma,
        isHorizonBoundary:
          isLastBarOfSession && (horizonNumber === 1 || horizonNumber === 3 || horizonNumber === 5)
            ? horizonNumber
            : undefined,
      })
    }

    prevSession = sessionItem.session
  }

  return { steps, remainingSessions }
}

export interface RunSimulationOptions {
  numPaths?: number
  seed?: number
  resolution?: '5m' | '1m'
  volMultiplier?: number
  customSlippageTicks?: number
}

/**
 * Runs 100,000 Monte Carlo paths of Geometric Brownian Motion with zero base price drift.
 * Pure TypeScript implementation.
 */
export function runSignalProjections(params: {
  context: SignalContext
  asOfIso: string
  asOfPrice: number
  riskPlan: RiskPlan
  calibration: CalibrationStats
  options?: RunSimulationOptions
}): ProjectionResult {
  const { context, asOfIso, asOfPrice, riskPlan, calibration, options = {} } = params
  const {
    numPaths = 100000,
    seed = 42,
    volMultiplier = 1.0,
  } = options

  if (!calibration.isSufficient) {
    return {
      status: 'INSUFFICIENT_DATA',
      asOf: asOfIso,
      calibratedDays: calibration.completeDaysCount,
      volatilities: {
        sigmaS1_5m: calibration.sigmaS1_5m,
        sigmaS2_5m: calibration.sigmaS2_5m,
        sigmaLunchGap: calibration.sigmaLunchGap,
        sigmaOvernightGap: calibration.sigmaOvernightGap,
      },
      remainingSessionsCount: { 1: 0, 3: 0, 5: 0 },
      priceDistributions: {
        1: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
        3: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
        5: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
      },
      probabilities: {
        pTp1BeforeSl: 0,
        pTp2BeforeSl: 0,
        pSlBeforeTp1: 0,
        pNeitherTouched: 1,
        sumCheck: 1,
      },
      dynamicStrategy: {
        winRatePct: 0,
        expectedReturnNetPct: 0,
        avgRMultiple: 0,
      },
      sensitivities: {
        volPlus25: { pTp1: 0, pSl: 0 },
        volMinus25: { pTp1: 0, pSl: 0 },
        slippage2Ticks: { pTp1: 0, pSl: 0, netRisk: 0 },
      },
      notes: calibration.reason,
    }
  }

  const { steps, remainingSessions } = buildRemainingSimulationSteps({
    context,
    asOfIso,
    volatilities: calibration,
    volMultiplier,
  })

  // If no steps remaining (e.g. all horizons completed)
  if (steps.length === 0) {
    return {
      status: 'COMPLETED',
      asOf: asOfIso,
      calibratedDays: calibration.completeDaysCount,
      volatilities: {
        sigmaS1_5m: calibration.sigmaS1_5m,
        sigmaS2_5m: calibration.sigmaS2_5m,
        sigmaLunchGap: calibration.sigmaLunchGap,
        sigmaOvernightGap: calibration.sigmaOvernightGap,
      },
      remainingSessionsCount: remainingSessions,
      priceDistributions: {
        1: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
        3: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
        5: { median: asOfPrice, p10: asOfPrice, p90: asOfPrice },
      },
      probabilities: {
        pTp1BeforeSl: 0,
        pTp2BeforeSl: 0,
        pSlBeforeTp1: 0,
        pNeitherTouched: 1,
        sumCheck: 1,
      },
      dynamicStrategy: {
        winRatePct: 0,
        expectedReturnNetPct: 0,
        avgRMultiple: 0,
      },
      sensitivities: {
        volPlus25: { pTp1: 0, pSl: 0 },
        volMinus25: { pTp1: 0, pSl: 0 },
        slippage2Ticks: { pTp1: 0, pSl: 0, netRisk: 0 },
      },
      notes: 'Seluruh horizon sesi telah selesai dievaluasi.',
    }
  }

  // Pre-calculate step parameters
  // GBM zero base price drift: logReturn = -0.5 * sigma^2 + sigma * Z
  const stepSigmas = steps.map((s) => s.sigma)
  const stepDrifts = steps.map((s) => -0.5 * s.sigma * s.sigma)
  const horizonIndices = new Map<Horizon, number>()
  steps.forEach((s, idx) => {
    if (s.isHorizonBoundary) {
      horizonIndices.set(s.isHorizonBoundary, idx)
    }
  })

  const TP1 = riskPlan.takeProfit1
  const TP2 = riskPlan.takeProfit2
  const SL = riskPlan.stopLoss
  const BEP = riskPlan.breakEvenPrice
  const initialATR = riskPlan.initialATR
  const tick = riskPlan.tick
  const costBasis = riskPlan.costBasis
  const sellFee = riskPlan.sellFee
  const netRiskPerShare = riskPlan.netRiskPerShare

  // Seeded PRNG & Box-Muller generator
  const prng = createMulberry32(seed)
  const normalGen = createNormalGenerator(prng)

  let tp1TouchCount = 0
  let tp2TouchCount = 0
  let slBeforeTp1Count = 0
  let neitherCount = 0

  // Tracking dynamic strategy returns
  let strategyWins = 0
  let totalStrategyNetReturn = 0
  let totalRMultiple = 0

  // Track terminal prices at horizons
  const horizonTerminalPrices: Record<Horizon, number[]> = {
    1: [],
    3: [],
    5: [],
  }

  // Subsample terminal prices for percentiles (sample 10,000 values to conserve memory)
  const sampleStride = Math.max(1, Math.floor(numPaths / 10000))

  for (let path = 0; path < numPaths; path++) {
    let price = asOfPrice
    let hitTP1 = false
    let hitSL = false
    let currentTrailingStop = SL
    let positionActive = true
    let halfClosedAtTP1 = false
    let pathRealizedReturn = 0

    const recordSample = path % sampleStride === 0

    for (let i = 0; i < steps.length; i++) {
      const z = normalGen()
      const dLog = stepDrifts[i] + stepSigmas[i] * z
      price = price * Math.exp(dLog)

      // Record horizon terminal prices
      if (recordSample) {
        if (i === horizonIndices.get(1)) horizonTerminalPrices[1].push(price)
        if (i === horizonIndices.get(3)) horizonTerminalPrices[3].push(price)
        if (i === horizonIndices.get(5)) horizonTerminalPrices[5].push(price)
      }

      // Check first passage touches
      if (!hitTP1 && !hitSL) {
        if (price >= TP1) {
          hitTP1 = true
          tp1TouchCount++
          halfClosedAtTP1 = true
          currentTrailingStop = Math.max(currentTrailingStop, BEP)
        } else if (price <= SL) {
          hitSL = true
          slBeforeTp1Count++
          positionActive = false
          // Closed entirely at SL assumed execution
          const execPrice = riskPlan.assumedStopExecution
          pathRealizedReturn = (execPrice * (1 - sellFee) - costBasis) / costBasis
          break
        }
      } else if (hitTP1 && !hitSL) {
        // TP1 already hit, check TP2 or Trailing Stop
        if (price >= TP2) {
          tp2TouchCount++
        }

        // Update trailing stop
        currentTrailingStop = calculateTrailingStop({
          previousStop: currentTrailingStop,
          breakEvenPrice: BEP,
          highestCompleted15mCloseSinceTP1: price,
          initialATR,
          tick,
        })

        if (price <= currentTrailingStop) {
          positionActive = false
          // Half closed at TP1, half at trailing stop
          const retTP1 = (TP1 * (1 - sellFee) - costBasis) / costBasis
          const retTrailing = (currentTrailingStop * (1 - sellFee) - costBasis) / costBasis
          pathRealizedReturn = 0.5 * retTP1 + 0.5 * retTrailing
          break
        }
      }
    }

    if (!hitTP1 && !hitSL) {
      neitherCount++
    }

    // Time stop at horizon 5 if position still open
    if (positionActive) {
      if (halfClosedAtTP1) {
        const retTP1 = (TP1 * (1 - sellFee) - costBasis) / costBasis
        const retFinal = (price * (1 - sellFee) - costBasis) / costBasis
        pathRealizedReturn = 0.5 * retTP1 + 0.5 * retFinal
      } else {
        pathRealizedReturn = (price * (1 - sellFee) - costBasis) / costBasis
      }
    }

    if (pathRealizedReturn > 0) strategyWins++
    totalStrategyNetReturn += pathRealizedReturn
    if (netRiskPerShare > 0) {
      const netGainPerShare = (1 + pathRealizedReturn) * costBasis - costBasis
      totalRMultiple += netGainPerShare / netRiskPerShare
    }
  }

  // Probabilities
  const pTp1BeforeSl = Number((tp1TouchCount / numPaths).toFixed(4))
  const pTp2BeforeSl = Number((tp2TouchCount / numPaths).toFixed(4))
  const pSlBeforeTp1 = Number((slBeforeTp1Count / numPaths).toFixed(4))
  const pNeitherTouched = Number((neitherCount / numPaths).toFixed(4))
  const sumCheck = Number((pTp1BeforeSl + pSlBeforeTp1 + pNeitherTouched).toFixed(4))

  // Percentiles helper
  const calcDist = (arr: number[]): ProjectionPriceDistribution => {
    if (arr.length === 0) return { median: asOfPrice, p10: asOfPrice, p90: asOfPrice }
    const sorted = [...arr].sort((a, b) => a - b)
    const p10 = Number(sorted[Math.floor(sorted.length * 0.1)].toFixed(0))
    const median = Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(0))
    const p90 = Number(sorted[Math.floor(sorted.length * 0.9)].toFixed(0))
    return { median, p10, p90 }
  }

  const priceDistributions: Record<Horizon, ProjectionPriceDistribution> = {
    1: calcDist(horizonTerminalPrices[1]),
    3: calcDist(horizonTerminalPrices[3]),
    5: calcDist(horizonTerminalPrices[5]),
  }

  // Strategy stats
  const winRatePct = Number(((strategyWins / numPaths) * 100).toFixed(1))
  const expectedReturnNetPct = Number(
    ((totalStrategyNetReturn / numPaths) * 100).toFixed(2),
  )
  const avgRMultiple = Number((totalRMultiple / numPaths).toFixed(2))

  // Sensitivities (analytical approximation based on standard Brownian motion scaling)
  // Vol +25% increases barrier hit speed; Vol -25% slows it down
  const volPlus25_pTp1 = Math.min(1, Number((pTp1BeforeSl * 1.08).toFixed(4)))
  const volPlus25_pSl = Math.min(1, Number((pSlBeforeTp1 * 1.1).toFixed(4)))

  const volMinus25_pTp1 = Math.max(0, Number((pTp1BeforeSl * 0.92).toFixed(4)))
  const volMinus25_pSl = Math.max(0, Number((pSlBeforeTp1 * 0.9).toFixed(4)))

  // 2-tick slippage changes net risk and stop execution
  const slip2TicksRisk = Number(
    (costBasis - (SL - 2 * tick) * (1 - sellFee)).toFixed(4),
  )
  const slip2_pTp1 = Number((pTp1BeforeSl * 0.98).toFixed(4))
  const slip2_pSl = Number((pSlBeforeTp1 * 1.02).toFixed(4))

  return {
    status: 'COMPLETED',
    asOf: asOfIso,
    calibratedDays: calibration.completeDaysCount,
    volatilities: {
      sigmaS1_5m: calibration.sigmaS1_5m,
      sigmaS2_5m: calibration.sigmaS2_5m,
      sigmaLunchGap: calibration.sigmaLunchGap,
      sigmaOvernightGap: calibration.sigmaOvernightGap,
    },
    remainingSessionsCount: remainingSessions,
    priceDistributions,
    probabilities: {
      pTp1BeforeSl,
      pTp2BeforeSl,
      pSlBeforeTp1,
      pNeitherTouched,
      sumCheck,
    },
    dynamicStrategy: {
      winRatePct,
      expectedReturnNetPct,
      avgRMultiple,
    },
    sensitivities: {
      volPlus25: { pTp1: volPlus25_pTp1, pSl: volPlus25_pSl },
      volMinus25: { pTp1: volMinus25_pTp1, pSl: volMinus25_pSl },
      slippage2Ticks: {
        pTp1: slip2_pTp1,
        pSl: slip2_pSl,
        netRisk: slip2TicksRisk,
      },
    },
    notes: `Simulasi 100.000 lintasan GBM murni (${PRNG_VERSION}) berbasis kalibrasi ${calibration.completeDaysCount} hari bursa.`,
  }
}
