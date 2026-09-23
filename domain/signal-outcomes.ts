import type {
  Horizon,
  IntradayBar,
  SessionId,
  SignalContext,
  SignalOutcome,
} from '../lib/contracts/signal-analysis.ts'
import {
  computeTargetSessions,
  getNextTradingDay,
  identifySession,
  isBarInContinuousTrading,
} from './trading-sessions.ts'

export type SignalOutcomeStatus =
  'PENDING' | 'MATURED' | 'MISSING_PRICE' | 'CORPORATE_ACTION_SUSPENDED'

export interface SignalOutcomeEvaluation {
  snapshotId: string
  ruleId: string
  ruleVersion: string
  ticker: string
  horizon: 1 | 3 | 5
  signalDate: string
  targetDate: string | null
  initialPrice: number | null
  targetPrice: number | null
  returnFraction: number | null
  status: SignalOutcomeStatus
}

/**
 * Evaluates 1, 3, and 5 session outcomes from a signal date against a chronological daily price series.
 * @param dailyPrices Price history sorted by date ascending (oldest first).
 */
export function evaluateSignalOutcomes(
  snapshotId: string,
  ticker: string,
  ruleId: string,
  ruleVersion: string,
  signalDate: string,
  initialPrice: number | null,
  dailyPrices: Array<{ date: string; close: number }>,
): SignalOutcomeEvaluation[] {
  const horizons: Array<1 | 3 | 5> = [1, 3, 5]

  // Find index of signal date in the daily series
  const signalIndex = dailyPrices.findIndex((p) => p.date === signalDate)

  return horizons.map((horizon) => {
    // If signal date not found in history
    if (signalIndex === -1) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice,
        targetPrice: null,
        returnFraction: null,
        status: 'MISSING_PRICE',
      }
    }

    const basePrice = initialPrice ?? dailyPrices[signalIndex].close
    if (!basePrice || basePrice <= 0) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice: null,
        targetPrice: null,
        returnFraction: null,
        status: 'MISSING_PRICE',
      }
    }

    const targetIndex = signalIndex + horizon

    // If target session has not yet occurred
    if (targetIndex >= dailyPrices.length) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice: basePrice,
        targetPrice: null,
        returnFraction: null,
        status: 'PENDING',
      }
    }

    // Target session is reached
    const targetSession = dailyPrices[targetIndex]
    const targetPrice = targetSession.close
    const returnFraction = Number(((targetPrice - basePrice) / basePrice).toFixed(4))

    return {
      snapshotId,
      ruleId,
      ruleVersion,
      ticker,
      horizon,
      signalDate,
      targetDate: targetSession.date,
      initialPrice: basePrice,
      targetPrice,
      returnFraction,
      status: 'MATURED',
    }
  })
}

// ---------------------------------------------------------------------------
// Intraday Session Outcomes Evaluator (New)
// ---------------------------------------------------------------------------

export function evaluateSessionSignalOutcomes(params: {
  context: SignalContext
  bars: IntradayBar[]
  asOfIso: string
  feedDelayMinutes?: number
}): SignalOutcome[] {
  const { context, bars, asOfIso, feedDelayMinutes = 10 } = params
  const horizons: Horizon[] = [1, 3, 5]

  const signalDate = new Date(context.signalAt)
  const sessionInfo = identifySession(signalDate)

  let baseDateStr = sessionInfo.dateStr
  let baseSession: SessionId = 'S1'

  if (sessionInfo.session === 'S1' || sessionInfo.session === 'S2') {
    baseSession = sessionInfo.session
  } else if (sessionInfo.session === 'PRE') {
    baseSession = 'S1'
  } else if (sessionInfo.session === 'LUNCH') {
    baseSession = 'S1' // Completed S1, entering S2 next
  } else {
    // POST or CLOSED: next trading day S1 is Horizon 1's starting baseline
    const nextDay = getNextTradingDay(baseDateStr)
    if (nextDay.calendarAvailable && nextDay.nextDate) {
      baseDateStr = nextDay.nextDate
      baseSession = 'S2' // Effectively next session is nextDay S1
    }
  }

  const targetSessions = computeTargetSessions(baseDateStr, baseSession)

  // Filter only bars completed before or at asOfIso
  const completedBars = bars.filter((b) => b.endAt <= asOfIso)

  return horizons.map((horizon) => {
    const target = targetSessions[horizon]

    if (!target || !target.calendarAvailable) {
      return {
        horizon,
        targetAt: '',
        targetSession: 'S1',
        targetDate: '',
        actualPrice: null,
        grossReturn: null,
        netReturn: null,
        status: 'CALENDAR_UNAVAILABLE',
        notes: 'Kalender BEI di luar rentang resmi (2024-2026).',
      }
    }

    const targetEndMs = new Date(target.targetEndAt).getTime()
    const asOfMs = new Date(asOfIso).getTime()
    const delayBufferMs = feedDelayMinutes * 60 * 1000

    // Target session hasn't completed yet
    if (asOfMs < targetEndMs) {
      return {
        horizon,
        targetAt: target.targetEndAt,
        targetSession: target.targetSession,
        targetDate: target.targetDate,
        actualPrice: null,
        grossReturn: null,
        netReturn: null,
        status: 'PENDING',
        notes: 'Menunggu penutupan sesi target.',
      }
    }

    // Target session completed in real time. Search for closing bar in completedBars
    const sessionBars = completedBars.filter((b) => {
      const check = isBarInContinuousTrading(b.startAt, b.endAt)
      return (
        check.isValidContinuous &&
        check.dateStr === target.targetDate &&
        check.session === target.targetSession
      )
    })

    // Find the last completed bar of this target session (within 5 min before targetEndAt)
    let closingBar: IntradayBar | null = null
    for (let i = sessionBars.length - 1; i >= 0; i--) {
      const b = sessionBars[i]
      const barEndMs = new Date(b.endAt).getTime()
      if (barEndMs <= targetEndMs && targetEndMs - barEndMs <= 5 * 60 * 1000) {
        closingBar = b
        break
      }
    }

    if (closingBar) {
      const actualPrice = closingBar.close
      const refPrice = context.referencePrice
      const buyFee = context.initialRiskParams?.buyFee ?? 0.0015
      const sellFee = context.initialRiskParams?.sellFee ?? 0.0025

      const grossReturn =
        refPrice > 0 ? Number(((actualPrice - refPrice) / refPrice).toFixed(4)) : null
      const costBasis = refPrice * (1 + buyFee)
      const netReturn =
        costBasis > 0
          ? Number(((actualPrice * (1 - sellFee) - costBasis) / costBasis).toFixed(4))
          : null

      return {
        horizon,
        targetAt: target.targetEndAt,
        targetSession: target.targetSession,
        targetDate: target.targetDate,
        actualPrice,
        grossReturn,
        netReturn,
        status: 'MATURED',
        notes: 'Sudah dievaluasi berdasarkan harga penutupan sesi kontinu.',
      }
    }

    // Closing bar not found. Has feed delay elapsed?
    if (asOfMs < targetEndMs + delayBufferMs) {
      return {
        horizon,
        targetAt: target.targetEndAt,
        targetSession: target.targetSession,
        targetDate: target.targetDate,
        actualPrice: null,
        grossReturn: null,
        netReturn: null,
        status: 'AWAITING_DATA',
        notes: `Menunggu pembaruan feed data (jeda resmi ~${feedDelayMinutes} menit).`,
      }
    }

    // Delay has passed and price is missing
    return {
      horizon,
      targetAt: target.targetEndAt,
      targetSession: target.targetSession,
      targetDate: target.targetDate,
      actualPrice: null,
      grossReturn: null,
      netReturn: null,
      status: 'MISSING_PRICE',
      notes: 'Harga penutup sesi belum tersedia pada feed.',
    }
  })
}
