import type {
  Horizon,
  IntradayBar,
  ProjectionPriceDistribution,
  ProjectionResult,
  RiskPlan,
  SessionId,
  SignalContext,
} from '../lib/contracts/signal-analysis.ts'
import { calculateRiskPlan, calculateTrailingStop } from './trade-risk.ts'
import {
  computeTargetSessions,
  getNextTradingDay,
  getSessionWindow,
  identifySession,
  isBarInContinuousTrading,
} from './trading-sessions.ts'

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
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1)
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

export const DEFAULT_SIMULATION_MAX_PATHS = 25000

export interface SimulationStepDefinition {
  type: '5m' | 'lunch_gap' | 'overnight_gap'
  session: SessionId
  sigma: number
  isHorizonBoundary?: Horizon
  isCompleted15mClose?: boolean
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

  let prevSession: SessionId | null = baseSession

  for (let sIdx = 0; sIdx < allForwardSessions.length; sIdx++) {
    const sessionItem = allForwardSessions[sIdx]
    const horizonNumber = (sIdx + 1) as Horizon

    const sessWin = getSessionWindow(sessionItem.dateStr, sessionItem.session)
    const sessStartMs = new Date(sessWin.startAt).getTime()
    const sessEndMs = new Date(sessWin.endAt).getTime()

    // Only simulate if this session or subsequent is pending
    if (sessEndMs <= asOfMs) {
      prevSession = sessionItem.session
      continue // Already elapsed
    }

    // Insert inter-session gap if transitioning and asOf has not passed session start
    if (prevSession !== null && asOfMs < sessStartMs) {
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
    const barCount = sessionItem.session === 'S1' ? (isFriday ? 30 : 36) : isFriday ? 22 : 28

    const barSigma =
      sessionItem.session === 'S1'
        ? volatilities.sigmaS1_5m * volMultiplier
        : volatilities.sigmaS2_5m * volMultiplier

    for (let b = 0; b < barCount; b++) {
      const barEndMs = sessStartMs + (b + 1) * 5 * 60 * 1000
      if (barEndMs <= asOfMs) {
        continue // Skip historical bar
      }

      const isLastBarOfSession = b === barCount - 1
      const isCompleted15mClose = ((b + 1) * 5) % 15 === 0 || isLastBarOfSession
      steps.push({
        type: '5m',
        session: sessionItem.session,
        sigma: barSigma,
        isHorizonBoundary:
          isLastBarOfSession && (horizonNumber === 1 || horizonNumber === 3 || horizonNumber === 5)
            ? horizonNumber
            : undefined,
        isCompleted15mClose,
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

interface SimulatedPathSummary {
  pTp1BeforeSl: number
  pTp2BeforeSl: number
  pSlBeforeTp1: number
  pNeitherTouched: number
  sumCheck: number
  winRatePct: number
  expectedReturnNetPct: number
  avgRMultiple: number
  horizonTerminalPrices: Record<Horizon, number[]>
}

function simulatePathsCore(params: {
  steps: SimulationStepDefinition[]
  numPaths: number
  seed: number
  asOfPrice: number
  riskPlan: RiskPlan
  sampleStride?: number
  horizonIndices?: Map<Horizon, number>
}): SimulatedPathSummary {
  const { steps, numPaths, seed, asOfPrice, riskPlan, sampleStride, horizonIndices } = params

  const stepSigmas = steps.map((s) => s.sigma)
  const stepDrifts = steps.map((s) => -0.5 * s.sigma * s.sigma)

  const TP1 = riskPlan.takeProfit1
  const TP2 = riskPlan.takeProfit2
  const SL = riskPlan.stopLoss
  const BEP = riskPlan.breakEvenPrice
  const initialATR = riskPlan.initialATR
  const tick = riskPlan.tick
  const costBasis = riskPlan.costBasis
  const sellFee = riskPlan.sellFee
  const netRiskPerShare = riskPlan.netRiskPerShare
  const stopSlippage = riskPlan.stopSlippage

  const prng = createMulberry32(seed)
  const normalGen = createNormalGenerator(prng)

  let tp1TouchCount = 0
  let tp2TouchCount = 0
  let slBeforeTp1Count = 0
  let neitherCount = 0

  let strategyWins = 0
  let totalStrategyNetReturn = 0
  let totalRMultiple = 0

  const horizonTerminalPrices: Record<Horizon, number[]> = {
    1: [],
    3: [],
    5: [],
  }

  const effectiveStride = sampleStride ?? Math.max(1, Math.floor(numPaths / 10000))

  for (let path = 0; path < numPaths; path++) {
    let price = asOfPrice
    let hitTP1 = false
    let hitTP2 = false
    let hitSL = false
    let currentTrailingStop = SL
    let highest15mCloseSinceTP1 = asOfPrice
    let positionActive = true
    let halfClosedAtTP1 = false
    let pathRealizedReturn = 0

    const recordSample = horizonIndices && path % effectiveStride === 0

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const z = normalGen()
      const dLog = stepDrifts[i] + stepSigmas[i] * z
      price = price * Math.exp(dLog)

      if (recordSample && horizonIndices) {
        if (i === horizonIndices.get(1)) horizonTerminalPrices[1].push(price)
        if (i === horizonIndices.get(3)) horizonTerminalPrices[3].push(price)
        if (i === horizonIndices.get(5)) horizonTerminalPrices[5].push(price)
      }

      if (!hitTP1 && !hitSL) {
        if (price >= TP1) {
          hitTP1 = true
          tp1TouchCount++
          halfClosedAtTP1 = true
          currentTrailingStop = Math.max(currentTrailingStop, BEP)
          highest15mCloseSinceTP1 = price

          // Check if TP2 is also hit in the same step
          if (price >= TP2) {
            hitTP2 = true
            tp2TouchCount++
            positionActive = false
            const retTP1 = (TP1 * (1 - sellFee) - costBasis) / costBasis
            const retTP2 = (TP2 * (1 - sellFee) - costBasis) / costBasis
            pathRealizedReturn = 0.5 * retTP1 + 0.5 * retTP2
            break
          }
        } else if (price <= SL) {
          hitSL = true
          slBeforeTp1Count++
          positionActive = false
          const execPrice = riskPlan.assumedStopExecution
          pathRealizedReturn = (execPrice * (1 - sellFee) - costBasis) / costBasis
          break
        }
      } else if (hitTP1 && !hitTP2 && positionActive) {
        if (price >= TP2) {
          hitTP2 = true
          tp2TouchCount++
          positionActive = false
          const retTP1 = (TP1 * (1 - sellFee) - costBasis) / costBasis
          const retTP2 = (TP2 * (1 - sellFee) - costBasis) / costBasis
          pathRealizedReturn = 0.5 * retTP1 + 0.5 * retTP2
          break
        }

        // Trailing stop triggers only on completed 15m close
        if (step.isCompleted15mClose) {
          highest15mCloseSinceTP1 = Math.max(highest15mCloseSinceTP1, price)
          currentTrailingStop = calculateTrailingStop({
            previousStop: currentTrailingStop,
            breakEvenPrice: BEP,
            highestCompleted15mCloseSinceTP1: highest15mCloseSinceTP1,
            initialATR,
            tick,
          })

          if (price <= currentTrailingStop) {
            positionActive = false
            const retTP1 = (TP1 * (1 - sellFee) - costBasis) / costBasis
            const trailingExec = Math.max(1, currentTrailingStop - stopSlippage)
            const retTrailing = (trailingExec * (1 - sellFee) - costBasis) / costBasis
            pathRealizedReturn = 0.5 * retTP1 + 0.5 * retTrailing
            break
          }
        }
      }
    }

    if (!hitTP1 && !hitSL) {
      neitherCount++
    }

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

  const pTp1BeforeSl = Number((tp1TouchCount / numPaths).toFixed(4))
  const pTp2BeforeSl = Number((tp2TouchCount / numPaths).toFixed(4))
  const pSlBeforeTp1 = Number((slBeforeTp1Count / numPaths).toFixed(4))
  const pNeitherTouched = Number((neitherCount / numPaths).toFixed(4))
  const sumCheck = Number((pTp1BeforeSl + pSlBeforeTp1 + pNeitherTouched).toFixed(4))

  const winRatePct = Number(((strategyWins / numPaths) * 100).toFixed(1))
  const expectedReturnNetPct = Number(((totalStrategyNetReturn / numPaths) * 100).toFixed(2))
  const avgRMultiple = Number((totalRMultiple / numPaths).toFixed(2))

  return {
    pTp1BeforeSl,
    pTp2BeforeSl,
    pSlBeforeTp1,
    pNeitherTouched,
    sumCheck,
    winRatePct,
    expectedReturnNetPct,
    avgRMultiple,
    horizonTerminalPrices,
  }
}

/**
 * Runs Monte Carlo paths of Geometric Brownian Motion with zero base price drift.
 * Paths are strictly capped at DEFAULT_SIMULATION_MAX_PATHS (25,000).
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
  const { seed = 42, volMultiplier = 1.0 } = options
  const effectiveNumPaths = Math.min(
    Math.max(1, options.numPaths ?? DEFAULT_SIMULATION_MAX_PATHS),
    DEFAULT_SIMULATION_MAX_PATHS,
  )

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

  const horizonIndices = new Map<Horizon, number>()
  steps.forEach((s, idx) => {
    if (s.isHorizonBoundary) {
      horizonIndices.set(s.isHorizonBoundary, idx)
    }
  })

  // Subsample terminal prices for percentiles (sample up to 10,000 values to conserve memory)
  const sampleStride = Math.max(1, Math.floor(effectiveNumPaths / 10000))

  // 1. Baseline simulation run
  const baseline = simulatePathsCore({
    steps,
    numPaths: effectiveNumPaths,
    seed,
    asOfPrice,
    riskPlan,
    sampleStride,
    horizonIndices,
  })

  // 2. Empirical sensitivity reruns using identical seeded PRNG stream
  const sensPaths = Math.min(effectiveNumPaths, 5000)

  // Vol +25%
  const { steps: stepsVolPlus25 } = buildRemainingSimulationSteps({
    context,
    asOfIso,
    volatilities: calibration,
    volMultiplier: 1.25,
  })
  const simVolPlus25 = simulatePathsCore({
    steps: stepsVolPlus25,
    numPaths: sensPaths,
    seed,
    asOfPrice,
    riskPlan,
  })

  // Vol -25%
  const { steps: stepsVolMinus25 } = buildRemainingSimulationSteps({
    context,
    asOfIso,
    volatilities: calibration,
    volMultiplier: 0.75,
  })
  const simVolMinus25 = simulatePathsCore({
    steps: stepsVolMinus25,
    numPaths: sensPaths,
    seed,
    asOfPrice,
    riskPlan,
  })

  // 2-tick slippage
  const riskPlan2Ticks = calculateRiskPlan({
    entry: riskPlan.entry,
    initialATR: riskPlan.initialATR,
    tick: riskPlan.tick,
    buyFee: riskPlan.buyFee,
    sellFee: riskPlan.sellFee,
    stopSlippageTicks: 2,
  })
  const simSlippage2Ticks = simulatePathsCore({
    steps,
    numPaths: sensPaths,
    seed,
    asOfPrice,
    riskPlan: riskPlan2Ticks,
  })

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
    1: calcDist(baseline.horizonTerminalPrices[1]),
    3: calcDist(baseline.horizonTerminalPrices[3]),
    5: calcDist(baseline.horizonTerminalPrices[5]),
  }

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
      pTp1BeforeSl: baseline.pTp1BeforeSl,
      pTp2BeforeSl: baseline.pTp2BeforeSl,
      pSlBeforeTp1: baseline.pSlBeforeTp1,
      pNeitherTouched: baseline.pNeitherTouched,
      sumCheck: baseline.sumCheck,
    },
    dynamicStrategy: {
      winRatePct: baseline.winRatePct,
      expectedReturnNetPct: baseline.expectedReturnNetPct,
      avgRMultiple: baseline.avgRMultiple,
    },
    sensitivities: {
      volPlus25: { pTp1: simVolPlus25.pTp1BeforeSl, pSl: simVolPlus25.pSlBeforeTp1 },
      volMinus25: { pTp1: simVolMinus25.pTp1BeforeSl, pSl: simVolMinus25.pSlBeforeTp1 },
      slippage2Ticks: {
        pTp1: simSlippage2Ticks.pTp1BeforeSl,
        pSl: simSlippage2Ticks.pSlBeforeTp1,
        netRisk: riskPlan2Ticks.netRiskPerShare,
      },
    },
    notes: `Simulasi ${effectiveNumPaths.toLocaleString('id-ID')} lintasan GBM murni (${PRNG_VERSION}) berbasis kalibrasi ${calibration.completeDaysCount} hari bursa.`,
  }
}
